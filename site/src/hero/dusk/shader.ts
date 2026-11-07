// @ts-nocheck: TGSL vector operators (`a + b` on vec3f) are valid for the typegpu transpiler but not for tsc. The
// shader is checked by the transpiler at build time (unplugin-typegpu) and by rendering (README.md, "Verify").
// Raft at dusk v2: one fragment shader.
//  - Sky: three-stop dusk gradient, warm sunward band, a limb-darkened sun squashed near the horizon, Mie-style glow,
//    a few lit cloud streaks low on the sides, stars in the blue hour. Its horizon colour is also the sea's fog colour,
//    so the sky and the sea meet at the same value (no seam).
//  - Sea: twelve sharp-crested directional waves with analytic gradients (anti-aliased per wave by pixel footprint),
//    tap swells + ripple rings, fresnel reflection of sky, island and raft, sun glitter, crest scattering, contact
//    darkening, a meniscus and bob ripples around the hull.
//  - Island: a silhouette (hills, canopy, three palms) on a vertical plane far out, hazed by the same atmosphere,
//    so the sea reflects it with the right waterline.
//  - Raft: two lashed logs (bark, end grain, 3-strand rope lashings) and the Sproutboat sprout (stem, cupped lens
//    leaves with translucency), raymarched inside a box; soft sun shadow, AO, wet darkening at the waterline.
import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import { dither, encode, fullscreenVert, hash21, maskAll, noise } from './gpu';

export const NW = 10;   // sea waves
export const NSW = 6;   // tap swells
export const DI = 70;   // island plane distance (world z = -DI)
export const DI2 = 120; // far islet plane

export const DU = d.struct({
  res: d.vec2f, time: d.f32, aspect: d.f32,
  camPos: d.vec3f, focal: d.f32,
  camF: d.vec3f, pixA: d.f32,
  camR: d.vec3f, light: d.f32,
  camU: d.vec3f, stars: d.f32,
  sun: d.vec3f, sunI: d.f32,
  raftPos: d.vec3f, sway: d.f32,
  raftX: d.vec3f, wake: d.f32,
  raftY: d.vec3f, hMean: d.f32,
  raftZ: d.vec3f, fogK: d.f32,
  sTop: d.vec3f, cloud: d.f32,
  lA: d.vec3f, sunR: d.f32,
  lB: d.vec3f, starFade: d.f32,
  rA: d.vec3f, rip: d.f32,
  rB: d.vec3f, glare: d.f32,
  drift: d.vec2f, isl: d.vec2f,
  isl2: d.vec2f, pad0: d.vec2f,
  zen: d.vec3f, mid: d.vec3f, hor: d.vec3f, warm: d.vec3f, glow: d.vec3f, sunC: d.vec3f,
  deep: d.vec3f, scat: d.vec3f, islC: d.vec3f, bark: d.vec3f, endw: d.vec3f, rope: d.vec3f,
  leaf: d.vec3f, leafT: d.vec3f, moss: d.vec3f, canvas: d.vec3f, cloudLit: d.vec3f, cloudShd: d.vec3f,
  mask0: d.vec4f, mask1: d.vec4f, mask2: d.vec4f, mask3: d.vec4f, maskK: d.vec4f,
  // the container ship: pose (world), defocus, smoke strength, and its palette
  shipPos: d.vec3f, dof: d.f32,
  shipX: d.vec3f, smoke: d.f32,
  shipY: d.vec3f, shipOn: d.f32,
  shipZ: d.vec3f, shipS: d.f32,
  cg: d.vec3f, cb: d.vec3f, ca: d.vec3f, cc: d.vec3f, cs: d.vec3f, ck: d.vec3f, hullC: d.vec3f, winC: d.vec3f,
  cells: d.arrayOf(d.vec4f, 60), // the cargo: per cell (i * 3 + j) four entries, [stack height, open, paint, 0] and three sprouts [x, z, height, turn]
  wv: d.arrayOf(d.vec4f, NW), // (dir.x, dir.z, k, amplitude)
  wq: d.arrayOf(d.vec4f, NW), // (omega, phase, sharpness, 0)
  sw: d.arrayOf(d.vec4f, NSW), // (x, z, age, amplitude)
});
export const L = tgpu.bindGroupLayout({ u: { uniform: DU } });

// raft constants (raft-local, metres-ish): two logs along x, side by side in z
export const LOG_R = 0.165;
export const LOG_Z = 0.172;
export const LOGS = [
  { x: 0.06, z: -LOG_Z, hl: 0.56, seed: 1.3 },  // back log
  { x: -0.05, z: LOG_Z, hl: 0.53, seed: 4.1 },  // front log
];
export const LASH = [-0.27, 0.29];
// swell and ripple shapes (mirrored on the CPU)
export const SW = { c: 1.7, k: 4.2, w: 0.55, decay: 0.32, c2: 0.95, k2: 17, w2: 0.035, decay2: 1.3, amp2: 0.22 };

// ============================================================================================= sea
/** (height, dh/dx, dh/dz). foot = pixel footprint in world units: waves shorter than it fade out (no shimmer). */
const seaWaves = (x: number, z: number, foot: number): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const t = u.time;
  const px = x + u.drift.x * t;
  const pz = z + u.drift.y * t;
  let h = d.f32(0);
  let gx = d.f32(0);
  let gz = d.f32(0);
  for (let i = 0; i < NW; i++) {
    const w = u.wv[i];
    const q = u.wq[i];
    const ph = (w.x * px + w.y * pz) * w.z - q.x * t + q.y;
    const e = std.exp(q.z * (std.sin(ph) - 1));
    const a = w.w * std.clamp(1.6 - foot * w.z * 0.55, 0, 1);
    h += a * e;
    const dd = a * q.z * std.cos(ph) * e * w.z;
    gx += dd * w.x;
    gz += dd * w.y;
  }
  // tap swells: a long packet that rocks the raft, and a fast ring of small ripples
  for (let i = 0; i < NSW; i++) {
    const s = u.sw[i];
    if (s.w > 0) {
      const dx = x - s.x;
      const dz = z - s.y;
      const r = std.sqrt(dx * dx + dz * dz) + 0.0001;
      const sp = 1 / (1 + r * 0.35);
      const f = r - SW.c * s.z;
      const env = s.w * std.exp(-s.z * SW.decay) * sp;
      const g = std.exp(-(f * f) / SW.w);
      const sn = std.sin(f * SW.k);
      const hh = env * sn * g;
      let dr = env * g * (SW.k * std.cos(f * SW.k) - sn * 2 * f / SW.w) - hh * 0.35 * sp;
      // ripples (fade with the footprint so they never alias)
      const f2 = r - SW.c2 * s.z;
      const env2 = s.w * SW.amp2 * std.exp(-s.z * SW.decay2) * std.clamp(1.6 - foot * SW.k2 * 0.55, 0, 1) * std.smoothstep(0, 0.25, s.z);
      const g2 = std.exp(-(f2 * f2) / SW.w2);
      const sn2 = std.sin(f2 * SW.k2);
      h += hh + env2 * sn2 * g2;
      dr += env2 * g2 * (SW.k2 * std.cos(f2 * SW.k2) - sn2 * 2 * f2 / SW.w2);
      gx += dr * dx / r;
      gz += dr * dz / r;
    }
  }
  return d.vec3f(h - u.hMean, gx, gz);
};

// ============================================================================================= sky
const horizCol = (rd: d.v3f): d.v3f => {
  'use gpu';
  // the sky's own colour at elevation 0 in this azimuth: the sea fogs into exactly this
  return skyBase(std.normalize(d.vec3f(rd.x, 0, rd.z)));
};

const skyBase = (rd: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const e = std.max(rd.y, 0);
  const hd = std.normalize(d.vec2f(rd.x, rd.z + 0.00001));
  const sh = std.normalize(d.vec2f(u.sun.x, u.sun.z));
  const cs = std.dot(hd, sh) * 0.5 + 0.5;
  let c = std.mix(u.hor, u.mid, 1 - std.exp(-e * 7));
  c = std.mix(c, u.zen, std.smoothstep(0.08, 0.75, e));
  // warm band toward the sun, hugging the horizon
  c = std.mix(c, u.warm, std.pow(cs, 8) * std.exp(-e * 14) * 0.9);
  // glow (wide halo + aureole)
  const mu = std.max(std.dot(rd, u.sun), 0);
  c = c + u.glow * u.sunI * (std.pow(mu, 12) * 0.012 + std.pow(mu, 90) * 0.1 + std.pow(mu, 900) * 0.55 + std.pow(mu, 4000) * 1.2 * u.light);
  return c;
};

const sunDisk = (rd: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const sr = std.normalize(d.vec3f(-u.sun.z, 0, u.sun.x));
  const su = std.cross(u.sun, sr);
  const x = std.dot(rd, sr);
  const y = std.dot(rd, su);
  const squash = std.mix(1, 1.18, std.smoothstep(0.03, 0, u.sun.y));
  const r = std.length(d.vec2f(x, y * squash)) / u.sunR;
  const fw = u.pixA / u.sunR * 1.2;
  const disk = std.smoothstep(1 + fw, 1 - fw, r) * std.step(0, std.dot(rd, u.sun));
  const mu = std.sqrt(std.max(1 - r * r, 0));
  const limb = 0.5 + 0.5 * std.pow(mu, 0.55);
  // lower half redder (more air), limb warmer
  const tint = std.mix(u.glow, u.sunC, std.clamp(mu * 0.8 + y / u.sunR * 0.25 + 0.2, 0, 1));
  const ext = std.smoothstep(-0.006, 0.035, rd.y);
  const warmth = std.mix(0.55, 0.15, u.light);
  return std.mix(std.mix(u.glow * 0.7, tint, ext), u.glow, warmth) * u.sunI * std.mix(2.6, 5, u.light) * limb * disk * (0.3 + 0.7 * ext);
};

const fbm4 = (p0: d.v2f): number => {
  'use gpu';
  let p = d.vec2f(p0);
  let v = d.f32(0);
  let a = d.f32(0.5);
  for (let i = 0; i < 4; i++) {
    v += a * noise(p);
    p = d.vec2f(p.x * 1.7 - p.y * 1.1 + 3.1, p.x * 1.1 + p.y * 1.7 + 7.7);
    a *= 0.5;
  }
  return v;
};

/** Low cloud streaks, kept to the sides and the horizon so the headline sits on clean sky. */
const clouds = (rd: d.v3f, base: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  let c = d.vec3f(base);
  const e = rd.y;
  if (e > 0.004 && u.cloud > 0) {
    const band = std.smoothstep(0.004, 0.03, e) * std.smoothstep(0.17, 0.05, e);
    // side weighting in camera space: little cloud behind the centred copy
    const side = std.smoothstep(0.05, 0.42, std.abs(std.dot(rd, u.camR)) / std.max(u.aspect * 0.5 / u.focal, 0.1));
    const w = band * (0.25 + 0.75 * side) * u.cloud;
    if (w > 0.001) {
      const cp = d.vec2f(rd.x, rd.z) / (e + 0.025);
      const q = d.vec2f(cp.x * 0.07 + u.time * 0.003, cp.y * 0.22);
      const n = fbm4(q);
      const dens = std.smoothstep(0.52, 0.8, n) * w;
      const mu = std.max(std.dot(rd, u.sun), 0);
      const lit = std.mix(u.cloudShd, u.cloudLit, std.clamp(std.pow(mu, 3) * 0.9 + 0.15, 0, 1));
      // silver lining on thin edges toward the sun
      const edge = u.glow * u.sunI * std.pow(mu, 10) * (1 - std.smoothstep(0.0, 0.35, dens)) * 0.6;
      c = std.mix(c, lit + edge, std.clamp(dens * 1.1, 0, 0.85));
    }
  }
  return c;
};

const stars = (rd: d.v3f): number => {
  'use gpu';
  const u = L.$.u;
  let s = d.f32(0);
  if (u.stars > 0.001 && rd.y > 0.06) {
    const az = std.atan2(rd.x, -rd.z);
    const g = d.vec2f(az, rd.y) * 150;
    const cell = std.floor(g);
    const f = g - cell;
    const h = hash21(cell);
    if (h > 0.955) {
      const pos = d.vec2f(hash21(cell + 17.13), hash21(cell + 3.71)) * 0.6 + 0.2;
      const dpx = std.length(f - pos) / 150 / u.pixA;
      const b = std.pow((h - 0.955) / 0.045, 2.5) * 0.55 * (0.8 + 0.2 * std.sin(u.time * 1.3 + h * 70));
      // stars come out one by one: each has its own threshold on starFade
      const on = std.smoothstep(h * 6 - 5.2, h * 6 - 4.9, u.starFade);
      s = b * on * std.exp(-dpx * dpx * 1.6) * std.smoothstep(0.1, 0.4, rd.y) * u.stars;
    }
  }
  return s;
};

// ============================================================================================= island
const sdSeg2 = (p: d.v2f, a: d.v2f, b: d.v2f): d.v2f => {
  'use gpu';
  const pa = p - a;
  const ba = b - a;
  const h = std.clamp(std.dot(pa, ba) / std.dot(ba, ba), 0, 1);
  return d.vec2f(std.length(pa - ba * h), h);
};

/** One palm in the island plane (units of the island scale). */
const palm = (p: d.v2f, base: d.v2f, ht: number, lean: number, seed: number): number => {
  'use gpu';
  const k = std.clamp((p.y - base.y) / ht, 0, 1);
  const tx = base.x + lean * k * k * ht;
  let dd = std.max(std.abs(p.x - tx) - std.mix(0.016, 0.009, k), std.max(base.y - p.y, p.y - base.y - ht));
  const top = d.vec2f(base.x + lean * ht, base.y + ht);
  if (std.length(p - top) < ht * 0.62) {
    for (let j = 0; j < 7; j++) {
      const fj = d.f32(j);
      const th = (fj / 6 - 0.5) * 4.6 + std.sin(seed + fj * 2.3) * 0.18;
      const dir = d.vec2f(std.sin(th), std.cos(th));
      const len = ht * (0.42 - 0.08 * std.abs(th) / 2.3);
      const droop = 0.25 + 0.45 * std.abs(std.sin(th));
      const p1 = top + dir * len * 0.5 + d.vec2f(0, len * 0.06);
      const p2 = top + dir * len + d.vec2f(0, -droop * len);
      const s1 = sdSeg2(p, top, p1);
      const s2 = sdSeg2(p, p1, p2);
      const w1 = s1.x - len * std.mix(0.03, 0.065, s1.y);
      const w2 = s2.x - len * std.mix(0.065, 0.005, s2.y);
      dd = std.min(dd, std.min(w1, w2));
    }
  }
  return dd;
};

/** Signed distance (island units, negative inside) of the main island silhouette; x across, y up from the water. */
const islandSd = (p: d.v2f, palms: number): number => {
  'use gpu';
  const x = p.x;
  let prof = 0.3 * std.exp(-std.pow((x + 0.18) / 0.4, 2)) + 0.16 * std.exp(-std.pow((x - 0.36) / 0.24, 2)) + 0.045;
  prof += 0.03 * (noise(d.vec2f(x * 9 + 2, 1.7)) - 0.5) + 0.014 * (noise(d.vec2f(x * 26 + 5, 4.3)) - 0.5);
  prof = prof * std.smoothstep(1.02, 0.7, std.abs(x)) - 0.006;
  let dd = (p.y - prof) * 0.9;
  if (palms > 0.5) {
    dd = std.min(dd, palm(p, d.vec2f(0.62, 0.05), 0.3, 0.42, d.f32(1)));
    dd = std.min(dd, palm(p, d.vec2f(0.7, 0.04), 0.24, 0.62, 2.7));
    dd = std.min(dd, palm(p, d.vec2f(-0.66, 0.05), 0.27, -0.38, 5.1));
  }
  return dd;
};

/** Island seen along a ray from ro: (coverage, height in island units) at its plane. */
const islandAt = (ro: d.v3f, rd: d.v3f, blur: number): d.v4f => {
  'use gpu';
  const u = L.$.u;
  let out = d.vec4f(0);
  if (rd.z < 0) {
    const t = (-DI - ro.z) / rd.z;
    const q = ro + rd * t;
    if (q.y > 0) {
      const S = u.isl.y;
      const p = d.vec2f((q.x - u.isl.x) / S, q.y / S);
      if (std.abs(p.x) < 1.1 && p.y < 0.75) {
        const fw = (t * u.pixA * blur) / S;
        const sd = islandSd(p, d.f32(1));
        out = d.vec4f(std.smoothstep(fw, -fw, sd), p.y, t, 1);
      }
    }
    // far islet (no palms, hazier)
    if (out.x < 0.99) {
      const t2 = (-DI2 - ro.z) / rd.z;
      const q2 = ro + rd * t2;
      if (q2.y > 0) {
        const S2 = u.isl2.y;
        const p2 = d.vec2f((q2.x - u.isl2.x) / S2, q2.y / S2);
        if (std.abs(p2.x) < 1.1 && p2.y < 0.5) {
          const fw2 = (t2 * u.pixA * blur) / S2;
          const sd2 = islandSd(d.vec2f(p2.x, p2.y * 1.6), d.f32(0));
          const c2 = std.smoothstep(fw2, -fw2, sd2) * (1 - out.x);
          out = d.vec4f(out.x + c2, std.select(p2.y, out.y, out.x > 0.01), std.select(t2, out.z, out.x > 0.01), std.select(2, out.w, out.x > 0.01));
        }
      }
    }
  }
  return out;
};

const islandShade = (hz: d.v3f, isl: d.v4f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  // atmospheric perspective: the same fog as the sea at that distance, thicker near the water
  const fog = 1 - std.exp(-isl.z * u.fogK);
  const base = std.exp(-isl.y / 0.09);
  const haze = std.clamp(fog * 0.92 + base * 0.3, 0, 0.97);
  // a faint warm rim from the low sun on the upper canopy
  const col = u.islC * (0.85 + 0.3 * std.smoothstep(0.05, 0.4, isl.y));
  return std.mix(col, hz, haze);
};

// ============================================================================================= raft SDF
const toLocal = (p: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const q = p - u.raftPos;
  return d.vec3f(std.dot(q, u.raftX), std.dot(q, u.raftY), std.dot(q, u.raftZ));
};
const toLocalDir = (v: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  return d.vec3f(std.dot(v, u.raftX), std.dot(v, u.raftY), std.dot(v, u.raftZ));
};
const toWorldDir = (v: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  return u.raftX * v.x + u.raftY * v.y + u.raftZ * v.z;
};

/** A log along x: rounded, gently irregular radius, slightly oblique cut ends. */
const sdLog = (p: d.v3f, cx: number, cz: number, hl: number, seed: number): number => {
  'use gpu';
  const q = d.vec3f(p.x - cx, p.y, p.z - cz);
  const r = LOG_R * (1 + 0.03 * std.sin(q.x * 4.1 + seed) + 0.014 * std.sin(q.x * 10.3 + seed * 2.3)) - 0.008 * q.x;
  const re = 0.034;
  const ex = std.abs(q.x + 0.05 * q.y + 0.03 * q.z) - hl;
  const dd = d.vec2f(std.length(d.vec2f(q.y, q.z)) - r + re, ex + re);
  return std.min(std.max(dd.x, dd.y), 0) + std.length(std.max(dd, d.vec2f(0))) - re;
};

/** A lashing: three strands of rope wound round both logs (a stadium in yz), at x = xc. */
const sdLash = (p: d.v3f, xc: number): number => {
  'use gpu';
  const rr = LOG_R + 0.014;
  const a = std.max(std.abs(p.z) - LOG_Z, 0);
  const dc = std.abs(std.length(d.vec2f(a, p.y)) - rr);
  const xl0 = p.x - xc + 0.004 * std.sin(p.z * 23 + p.y * 17);
  const xl = xl0 - std.clamp(std.round(xl0 / 0.034), -1, 1) * 0.034;
  return std.length(d.vec2f(dc, xl)) - 0.0185;
};

const sdLens2 = (p0: d.v2f, b: number, w: number): number => {
  'use gpu';
  const p = std.abs(p0);
  const r = (b * b + w * w) / (2 * w);
  const dd = r - w;
  let out = std.length(p - d.vec2f(-dd, 0)) - r;
  if ((p.y - b) * dd > p.x * b) {
    out = std.length(p - d.vec2f(0, b));
  }
  return out;
};

/** A cupped, lens-shaped leaf from `q` = point relative to the stem top; A along the leaf, B across. */
const sdLeaf = (q: d.v3f, A: d.v3f, B: d.v3f, len: number): number => {
  'use gpu';
  const N = std.cross(A, B);
  const a = std.dot(q, A);
  const b = std.dot(q, B);
  const w = std.dot(q, N) - (2.6 * b * b + 0.25 * a * a / len);
  const d2 = sdLens2(d.vec2f(b, a - len * 0.5), len * 0.5, len * 0.25) - 0.006;
  const th = 0.0045 + 0.004 * std.max(1 - std.abs(b) / (len * 0.25), 0);
  const dz = std.abs(w) - th;
  return std.length(std.max(d.vec2f(d2, dz), d.vec2f(0))) + std.min(std.max(d2, dz), 0);
};

/** Raft-local scene: (distance, material). 1 wood, 2 rope, 3 stem, 4 left leaf, 5 right leaf, 6 moss. */
const mapRaft = (p: d.v3f): d.v2f => {
  'use gpu';
  const u = L.$.u;
  const l1 = sdLog(p, 0.06, -LOG_Z, 0.56, 1.3);
  const l2 = sdLog(p, -0.05, LOG_Z, 0.53, 4.1);
  let res = d.vec2f(std.min(l1, l2), 1);
  // lashings only matter near their x
  if (std.abs(std.abs(p.x - 0.01) - 0.28) < 0.12) {
    const rp = std.min(sdLash(p, -0.27), sdLash(p, 0.29));
    if (rp < res.x) { res = d.vec2f(rp, 2); }
  }
  // the sprout, inside its own bounding sphere
  const bq = std.abs(p - d.vec3f(0.01, 0.38, 0.0)) - d.vec3f(0.26, 0.34, 0.16);
  const bs = std.length(std.max(bq, d.vec3f(0))) + std.min(std.max(bq.x, std.max(bq.y, bq.z)), 0);
  if (bs < res.x) {
    const moss = std.length((p - d.vec3f(0.01, 0.05, 0.005)) / d.vec3f(0.085, 0.045, 0.06)) - 1;
    const mossD = moss * 0.04;
    if (mossD < res.x) { res = d.vec2f(mossD, 6); }
    const k = std.clamp((p.y - 0.06) / (u.sTop.y - 0.06), 0, 1);
    const off = (u.sTop.x - 0.01) * k * k;
    const offz = (u.sTop.z - 0.005) * k * k;
    const ps = d.vec3f(p.x - 0.01 - off, p.y, p.z - 0.005 - offz);
    const stem = std.length(d.vec2f(ps.x, ps.z)) - std.mix(0.017, 0.012, k);
    const stemD = std.max(stem, std.max(0.06 - p.y, p.y - u.sTop.y)) ;
    if (stemD < res.x) { res = d.vec2f(stemD, 3); }
    const q = p - u.sTop;
    const lb = std.length(q - u.lA * 0.118) - 0.135;
    if (lb < res.x) {
      const lf = sdLeaf(q, u.lA, u.lB, 0.235);
      if (lf < res.x) { res = d.vec2f(lf, 4); }
    }
    const rb = std.length(q - u.rA * 0.095) - 0.11;
    if (rb < res.x) {
      const rf = sdLeaf(q, u.rA, u.rB, 0.19);
      if (rf < res.x) { res = d.vec2f(rf, 5); }
    }
  }
  return res;
};


/** Slab test against the raft's box, raft-local. (t near, t far). */
const boxHit = (lo: d.v3f, ld: d.v3f): d.v2f => {
  'use gpu';
  const sd = std.select(ld, d.vec3f(0.000001), std.lt(std.abs(ld), d.vec3f(0.000001)));
  const inv = d.vec3f(1) / sd;
  const t0 = (d.vec3f(-0.66, -0.22, -0.4) - lo) * inv;
  const t1 = (d.vec3f(0.69, 0.78, 0.4) - lo) * inv;
  const tmin = std.min(t0, t1);
  const tmax = std.max(t0, t1);
  return d.vec2f(std.max(std.max(tmin.x, tmin.y), tmin.z), std.min(std.min(tmax.x, tmax.y), tmax.z));
};

/** March a world ray against the raft. (t, material); t < 0 = miss. */
const marchRaft = (ro: d.v3f, rd: d.v3f, lim: number, tMax: number): d.v2f => {
  'use gpu';
  const u = L.$.u;
  const lo = toLocal(ro);
  const ld = toLocalDir(rd);
  const bb = boxHit(lo, ld);
  let out = d.vec2f(-1, 0);
  const tEnd = std.min(bb.y, tMax);
  if (tEnd > std.max(bb.x, 0)) {
    let t = std.max(bb.x, 0);
    for (let i = 0; i < 72; i++) {
      const h = mapRaft(lo + ld * t);
      if (h.x < 0.0004 + t * u.pixA * 0.45) {
        out = d.vec2f(t, h.y);
        break;
      }
      t += h.x * 0.82;
      if (t > tEnd || d.f32(i) > lim) {
        break;
      }
    }
  }
  return out;
};

const normalAt = (p: d.v3f): d.v3f => {
  'use gpu';
  const e = 0.0011;
  const a = mapRaft(p + d.vec3f(e, -e, -e)).x;
  const b = mapRaft(p + d.vec3f(-e, -e, e)).x;
  const c = mapRaft(p + d.vec3f(-e, e, -e)).x;
  const f = mapRaft(p + d.vec3f(e, e, e)).x;
  return std.normalize(d.vec3f(e, -e, -e) * a + d.vec3f(-e, -e, e) * b + d.vec3f(-e, e, -e) * c + d.vec3f(e, e, e) * f);
};

const softShadow = (p: d.v3f, l: d.v3f): number => {
  'use gpu';
  let res = d.f32(1);
  let t = d.f32(0.01);
  for (let i = 0; i < 12; i++) {
    const h = mapRaft(p + l * t).x;
    res = std.min(res, 9 * h / t);
    t += std.clamp(h, 0.016, 0.14);
    if (res < 0.01 || t > 1.3) {
      break;
    }
  }
  return std.clamp(res, 0, 1);
};

const calcAO = (p: d.v3f, n: d.v3f): number => {
  'use gpu';
  let occ = d.f32(0);
  let sca = d.f32(1);
  for (let i = 0; i < 3; i++) {
    const hh = 0.014 + 0.05 * d.f32(i);
    const dd = mapRaft(p + n * hh).x;
    occ += (hh - dd) * sca;
    sca *= 0.75;
  }
  return std.clamp(1 - 2.6 * occ, 0, 1);
};

// ============================================================================================= raft shading
const barkPat = (s: number, x: number): number => {
  'use gpu';
  const n1 = noise(d.vec2f(s * 34, x * 5.5));
  const n2 = noise(d.vec2f(s * 95, x * 17 + 3.1));
  const ridge = 1 - std.abs(n1 * 2 - 1);
  return ridge * 0.7 + n2 * 0.3;
};

/** Albedo + normal tweak for wood at local point pl with local normal nl. Returns albedo; w = roughness hint. */
const woodAlbedo = (pl: d.v3f, nl: d.v3f, detail: number): d.v4f => {
  'use gpu';
  const u = L.$.u;
  const front = pl.z > 0;
  const cz = std.select(-LOG_Z, LOG_Z, front);
  const cx = std.select(0.06, -0.05, front);
  const hl = std.select(0.56, 0.53, front);
  const ry = pl.y;
  const rz = pl.z - cz;
  const rr = std.length(d.vec2f(ry, rz));
  const ang = std.atan2(ry, rz);
  const endF = std.smoothstep(0.55, 0.9, std.abs(nl.x));
  // bark: furrows along the log, lichen in places
  const s = ang * LOG_R;
  const bp = barkPat(s, pl.x);
  let bark = std.mix(u.bark * 0.5, u.bark * 1.12, bp);
  const li = std.smoothstep(0.62, 0.8, noise(d.vec2f(s * 9 + 11, pl.x * 3.2 + cx * 20)));
  bark = std.mix(bark, u.bark * d.vec3f(0.95, 1.08, 0.98) * 1.35, li * 0.45 * detail);
  // end grain: growth rings, darker heart, a couple of radial checks, a bark ring at the rim
  const rn = rr / LOG_R;
  const wob = noise(d.vec2f(ang * 2.2 + cx * 9, rr * 18)) * 3.2;
  const ring = std.sin(rr * 240 + wob) * 0.5 + 0.5;
  let endc = u.endw * std.mix(0.8, 1.04, ring) * std.mix(0.78, 1, std.smoothstep(0.05, 0.45, rn));
  const chk = std.smoothstep(0.93, 0.99, noise(d.vec2f(ang * 3.4 + hl * 7, 0.5))) * std.smoothstep(0.12, 0.4, rn);
  endc = endc * (1 - chk * 0.55 * detail);
  endc = std.mix(endc, bark * 0.8, std.smoothstep(0.86, 0.95, rn));
  const alb = std.mix(bark, endc, endF);
  return d.vec4f(alb, bp);
};

const ropeAlbedo = (pl: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const az = std.abs(pl.z);
  const rr = LOG_R + 0.011;
  const sAround = std.sign(pl.z) * (LOG_Z + rr * std.atan2(pl.y, std.max(az - LOG_Z, 0.0001)));
  const s = std.select(pl.z, sAround, az > LOG_Z);
  const xl0 = std.select(pl.x + 0.27, pl.x - 0.29, pl.x > 0.0);
  const xl = xl0 - std.round(xl0 / 0.034) * 0.034;
  const tw = std.sin(s * 170 + xl * 210 + std.select(0, 1.7, pl.y < 0));
  const fib = noise(d.vec2f(s * 300, xl * 300));
  return u.rope * (0.62 + 0.32 * std.smoothstep(-0.8, 0.8, tw) + 0.12 * fib);
};

/** Full shading for a primary raft hit. */
const shadeRaft = (pw: d.v3f, rd: d.v3f, mat: number, waterH: number): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const pl = toLocal(pw);
  let nl = normalAt(pl);
  let alb = d.vec3f(u.bark);
  let gloss = d.f32(0);
  if (mat < 1.5) {
    const wa = woodAlbedo(pl, nl, d.f32(1));
    alb = d.vec3f(wa.x, wa.y, wa.z);
    // bark bump from the furrow pattern (sides only)
    const side = 1 - std.smoothstep(0.55, 0.9, std.abs(nl.x));
    const front = pl.z > 0;
    const cz = std.select(-LOG_Z, LOG_Z, front);
    const ang = std.atan2(pl.y, pl.z - cz);
    const s = ang * LOG_R;
    const e = 0.004;
    const b0 = wa.w;
    const bs = barkPat(s + e, pl.x);
    const bx = barkPat(s, pl.x + e * 3);
    const tng = d.vec3f(0, std.cos(ang), -std.sin(ang));
    nl = std.normalize(nl - (tng * (bs - b0) / e + d.vec3f(1, 0, 0) * (bx - b0) / (e * 3)) * 0.0075 * side);
  } else if (mat < 2.5) {
    alb = ropeAlbedo(pl);
  } else if (mat < 3.5) {
    alb = u.leaf * 1.1;
  } else if (mat < 4.5) {
    alb = d.vec3f(u.leaf);
  } else if (mat < 5.5) {
    alb = std.mix(u.leaf, u.leafT, 0.18);
  } else {
    alb = u.moss * (0.8 + 0.4 * noise(d.vec2f(pl.x * 90, pl.z * 90)));
  }
  let n = std.normalize(toWorldDir(nl));
  const isLeaf = mat > 3.5 && mat < 5.5;
  if (isLeaf) {
    const lq = pl - u.sTop;
    const LA = std.select(u.rA, u.lA, mat < 4.5);
    const LB = std.select(u.rB, u.lB, mat < 4.5);
    const LN = std.cross(LA, LB);
    const la = std.dot(lq, LA);
    const lb = std.dot(lq, LB);
    const lenL = std.select(0.19, 0.235, mat < 4.5);
    n = std.normalize(toWorldDir(std.normalize(LN - LA * (0.5 * la / lenL) - LB * (5.2 * lb))));
  }
  if (isLeaf && std.dot(n, rd) > 0) {
    n = n * -1;
  }
  // wet darkening and sheen at the waterline
  const wet = std.smoothstep(0.07, -0.005, pw.y - waterH) * std.select(d.f32(1), d.f32(0), mat > 2.5);
  alb = alb * std.mix(1, 0.48, wet);
  gloss = wet;
  const sunL = toLocalDir(u.sun);
  const sh = softShadow(pl + nl * 0.004, sunL);
  const ao = calcAO(pl, nl);
  const dif = std.max(std.dot(n, u.sun), 0);
  const back = std.max(std.dot(rd, u.sun), 0);
  const up = std.mix(u.hor, u.mid, 0.5);
  const hemi = std.mix(u.hor * 0.35 + u.deep * 0.4, up * 1.05, n.y * 0.5 + 0.5);
  // the side facing the camera also gets the low warm horizon light bounced off the water
  let col = alb * (u.sunC * u.sunI * dif * sh + hemi * ao * 1.35);
  // rim: grazing light from the low sun behind
  const fr = std.pow(1 - std.max(std.dot(n, rd * -1), 0), 3);
  col = col + u.sunC * u.sunI * fr * std.pow(back, 3) * 0.75 * (0.35 + 0.65 * sh) * std.select(d.f32(1), d.f32(0.2), mat > 2.5);
  // wet sheen: reflect the sky
  const rf = std.reflect(rd, n);
  col = col + skyBase(d.vec3f(rf.x, std.abs(rf.y), rf.z)) * gloss * (0.04 + 0.5 * fr) * ao;
  col = col + u.sunC * u.sunI * std.pow(std.max(std.dot(rf, u.sun), 0), 60) * gloss * sh * 1.2;
  if (isLeaf || (mat > 2.5 && mat < 3.5)) {
    // translucency: the low sun through the leaf, veins darker, edges brighter
    let vein = d.f32(0);
    if (isLeaf) {
      const q = pl - u.sTop;
      const B = std.select(u.rB, u.lB, mat < 4.5);
      const A = std.select(u.rA, u.lA, mat < 4.5);
      const b = std.dot(q, B);
      const a = std.dot(q, A);
      const ln = std.select(0.19, 0.235, mat < 4.5);
      const halfw = std.max(ln * 0.25 * std.sin(std.clamp(a / ln, 0, 1) * 3.14159), 0.002);
      vein = std.smoothstep(0.006, 0.0, std.abs(b)) * 0.6 + std.smoothstep(0.004, 0.0, std.abs(std.abs(b) - (a - ln * 0.2) * 0.35 * std.step(ln * 0.2, a))) * 0.25;
      col = col * (1 - 0.15 * std.smoothstep(0.7, 1.0, std.abs(b) / halfw));
    }
    const tr = std.pow(back, 2.5) * std.select(0.35 + 0.65 * sh, d.f32(1), isLeaf) * std.mix(1, 0.6, u.light);
    col = col + u.leafT * u.sunC * u.sunI * tr * std.select(0.3, 0.62, isLeaf) * (1 - vein * 0.45);
    // waxy sheen
    col = col + skyBase(d.vec3f(rf.x, std.abs(rf.y), rf.z)) * fr * 0.08;
  }
  return col;
};

/** Cheap shading for reflections and the submerged hull. */
const shadeRaftLite = (pw: d.v3f, rd: d.v3f, mat: number): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const pl = toLocal(pw);
  const nl = normalAt(pl);
  let alb = d.vec3f(u.bark);
  if (mat < 1.5) {
    alb = std.mix(u.bark * 0.85, u.endw * 0.9, std.smoothstep(0.55, 0.9, std.abs(nl.x)));
  } else if (mat < 2.5) {
    alb = u.rope * 0.85;
  } else if (mat < 5.5) {
    alb = d.vec3f(u.leaf);
  } else {
    alb = d.vec3f(u.moss);
  }
  const n = toWorldDir(nl);
  const back = std.max(std.dot(rd, u.sun), 0);
  const hemi = std.mix(u.deep * 0.5 + u.hor * 0.2, std.mix(u.mid, u.zen, 0.4), n.y * 0.5 + 0.5);
  let col = alb * (u.sunC * u.sunI * std.max(std.dot(n, u.sun), 0) * 0.8 + hemi * 0.85);
  if (mat > 2.5 && mat < 5.5) {
    col = col + u.leafT * u.sunC * u.sunI * std.pow(back, 2.5) * 0.25;
  }
  return col;
};

// ============================================================================================= container ship
// Ship-local frame: +x bow, +y up from the waterline, z across. Metres-ish: 7.5 long, chunky and toy-like. The cargo is a
// grid of 5 bays x 3 columns of stacks (1 to 3 containers high); the top container of a stack is sometimes open, with soil
// and three sprouts in it. Deckhouse, funnel and a pennant at the stern.
const DECK = 0.7;
const CL = 1.0;    // container length (bay pitch)
const CW = 0.68;   // container width (column pitch)
const CH = 0.46;   // container height
const CX0 = -2.15; // bay 0 starts here

const sdBox = (p: d.v3f, b: d.v3f): number => {
  'use gpu';
  const q = std.abs(p) - b;
  return std.length(std.max(q, d.vec3f(0))) + std.min(std.max(q.x, std.max(q.y, q.z)), 0);
};
const sdRBox = (p: d.v3f, b: d.v3f, r: number): number => {
  'use gpu';
  const q = std.abs(p) - b + d.vec3f(r);
  return std.length(std.max(q, d.vec3f(0))) + std.min(std.max(q.x, std.max(q.y, q.z)), 0) - r;
};

const toShip = (p: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const q = (p - u.shipPos) / u.shipS;
  return d.vec3f(std.dot(q, u.shipX), std.dot(q, u.shipY), std.dot(q, u.shipZ));
};
const toShipDir = (v: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  return d.vec3f(std.dot(v, u.shipX), std.dot(v, u.shipY), std.dot(v, u.shipZ));
};
const shipToWorldDir = (v: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  return u.shipX * v.x + u.shipY * v.y + u.shipZ * v.z;
};

/** Half-beam of the hull at height y: elliptic-ish bow, raked, flared toward the deck. */
const hullHalf = (x: number, y: number): number => {
  'use gpu';
  const xb = x - 0.3 * y;
  const t = std.clamp((xb - 1.7) / 2.2, 0, 1);
  return 1.15 * (1 - t * t) * (0.8 + 0.2 * std.smoothstep(-0.5, 0.75, y));
};
const sdHull = (p: d.v3f): number => {
  'use gpu';
  const r = 0.12;
  const w = hullHalf(p.x, p.y);
  const a = std.abs(p.z) - (w - r);
  const b = std.abs(p.y - 0.1) - (0.6 - r);
  const c = std.max(-3.6 + r - p.x, p.x - 0.3 * p.y - 3.9 + r);
  const q = d.vec3f(a, b, c);
  return (std.length(std.max(q, d.vec3f(0))) + std.min(std.max(a, std.max(b, c)), 0) - r) * 0.8;
};

/** Cargo table entry 0 of cell (i, j): [stack height in containers (0 = none), open, paint, 0]. */
const cellMeta = (i: number, j: number): d.v4f => {
  'use gpu';
  const u = L.$.u;
  let m = d.vec4f(0);
  if (i > -0.5 && i < 4.5 && j > -0.5 && j < 2.5) {
    m = d.vec4f(u.cells[d.u32(i * 12 + j * 4 + 0.5)]);
  }
  return m;
};

/** A sprout in the open container's soil: bent stem and a mirrored pair of tilted leaf ellipsoids. (dist, material) */
const sprout = (q: d.v3f, hg: number, ang: number): d.v2f => {
  'use gpu';
  const k = std.clamp(q.y / hg, 0, 1);
  const sq = d.vec3f(q.x - 0.035 * k * k, q.y - std.clamp(q.y, 0, hg), q.z);
  const ds = std.length(sq) - 0.032;
  const lp = q - d.vec3f(0.035, hg, 0);
  const c = std.cos(ang);
  const s = std.sin(ang);
  const rx = lp.x * c - lp.z * s;
  const rz = lp.x * s + lp.z * c;
  const ax = std.abs(rx) - 0.15;
  const ly = lp.y - 0.025;
  const pe = d.vec3f(ax * 0.9 + ly * 0.43, ly * 0.9 - ax * 0.43, rz);
  const rr = d.vec3f(0.19, 0.03, 0.11);
  const k0 = std.length(pe / rr);
  const k1 = std.length(pe / (rr * rr));
  const dl = k0 * (k0 - 1) / std.max(k1, 0.0001);
  const lp2 = q - d.vec3f(0.02, hg * 0.62, 0);
  const rx2 = lp2.z * c + lp2.x * s;
  const rz2 = lp2.x * c - lp2.z * s;
  const ax2 = std.abs(rx2) - 0.12;
  const ly2 = lp2.y - 0.02;
  const pe2 = d.vec3f(ax2 * 0.9 + ly2 * 0.43, ly2 * 0.9 - ax2 * 0.43, rz2);
  const rr2 = d.vec3f(0.15, 0.026, 0.085);
  const m0 = std.length(pe2 / rr2);
  const m1 = std.length(pe2 / (rr2 * rr2));
  const dl2 = std.min(dl, m0 * (m0 - 1) / std.max(m1, 0.0001));
  return std.select(d.vec2f(dl2, 8), d.vec2f(ds, 7), ds < dl2);
};

/** One cell's container (and its soil and sprouts when open). (dist, material) */
const cellD = (p: d.v3f, i: number, j: number): d.v2f => {
  'use gpu';
  let res = d.vec2f(1000, 0);
  const meta = cellMeta(i, j);
  const n = meta.x;
  if (n > 0.5) {
    const cx = CX0 + 0.5 + i;
    const cz = (j - 1) * CW;
    const H = n * CH;
    const q = p - d.vec3f(cx, DECK + H * 0.5, cz);
    res = d.vec2f(sdRBox(q, d.vec3f(CL * 0.5 - 0.02, H * 0.5 - 0.002, CW * 0.5 - 0.02), 0.03), 5);
    const top = DECK + H;
    if (meta.y > 0.5 && p.y > top - 0.3 && p.y < top + 0.7) {
      const dep = sdBox(p - d.vec3f(cx, top - 0.1 + 0.5, cz), d.vec3f(CL * 0.5 - 0.075, 0.5, CW * 0.5 - 0.075));
      if (-dep > res.x) {
        res = d.vec2f(-dep, 6);
      }
      for (let k = 0; k < 3; k++) {
        const sd = d.vec4f(L.$.u.cells[d.u32(i * 12 + j * 4 + 1.5 + d.f32(k))]);
        const sp = sprout(p - d.vec3f(cx + sd.x, top - 0.1, cz + sd.y), sd.z, sd.w);
        if (sp.x < res.x) {
          res = d.vec2f(sp);
        }
      }
    }
  }
  return res;
};

/** Ship-local scene: (distance, material). 1 hull, 3 deckhouse, 4 funnel, 5 container, 6 soil, 7 stem, 8 leaf, 9 pennant. */
const mapShip = (p: d.v3f): d.v2f => {
  'use gpu';
  let res = d.vec2f(sdHull(p), 1);
  // deckhouse, funnel, mast: a bounding box first
  // (bounds return material 0: they steer the march but never count as the ship's edge)
  const mg = 0.1 + L.$.u.dof * 40;
  const hb = sdBox(p - d.vec3f(-2.95, 2.2, 0), d.vec3f(0.95, 1.7, 1.15));
  if (hb > mg) {
    if (hb < res.x) {
      res = d.vec2f(hb, 0);
    }
  } else {
    const h1 = sdRBox(p - d.vec3f(-2.95, 1.25, 0), d.vec3f(0.62, 0.55, 0.92), 0.08);
    const h2 = sdRBox(p - d.vec3f(-3.0, 2.12, 0), d.vec3f(0.48, 0.32, 0.78), 0.08);
    const h3 = sdRBox(p - d.vec3f(-2.62, 2.65, 0), d.vec3f(0.36, 0.21, 1.0), 0.07);
    const hd = std.min(h1, std.min(h2, h3));
    if (hd < res.x) {
      res = d.vec2f(hd, 3);
    }
    const fq = d.vec2f((p.x + 3.25) / 0.27, p.z / 0.34);
    const fr = (std.length(fq) - 1) * 0.27;
    const fy = std.abs(p.y - 2.8) - 0.6;
    const fd = std.max(fr, fy) * 0.85;
    if (fd < res.x) {
      res = d.vec2f(fd, 4);
    }
    const mq = d.vec3f(p.x + 2.62, p.y - std.clamp(p.y, 2.86, 3.55), p.z);
    const dm = std.length(mq) - 0.025;
    if (dm < res.x) {
      res = d.vec2f(dm, 4);
    }
    const fl = sdBox(p - d.vec3f(-2.46, 3.42 + 0.03 * std.sin(p.x * 9 + L.$.u.time * 3), 0), d.vec3f(0.17, 0.08, 0.01)) * 0.7;
    if (fl < res.x) {
      res = d.vec2f(fl, 9);
    }
  }
  // cargo: the four cells nearest the point
  const cb = sdBox(p - d.vec3f(0.5, 1.65, 0), d.vec3f(2.7, 1.1, 1.08));
  if (cb > mg) {
    if (cb < res.x) {
      res = d.vec2f(cb, 0);
    }
  } else {
    const cu = p.x - CX0;
    const cv = p.z / CW + 1.5;
    const i0 = std.floor(cu);
    const j0 = std.floor(cv);
    const own = cellD(p, i0, j0);
    // the cell's own walls bound the step: nothing of the neighbours lies this side of them
    const wall = std.min((0.5 - std.abs(cu - i0 - 0.5)) * CL, CW * 0.5 - std.abs((cv - j0 - 0.5) * CW)) + 0.035;
    if (own.x < wall) {
      if (own.x < res.x) {
        res = d.vec2f(own);
      }
    } else if (wall < res.x) {
      res = d.vec2f(wall, 0);
    }
  }
  return res;
};

const shipBox = (lo: d.v3f, ld: d.v3f, m: number): d.v2f => {
  'use gpu';
  const sd = std.select(ld, d.vec3f(0.000001), std.lt(std.abs(ld), d.vec3f(0.000001)));
  const inv = d.vec3f(1) / sd;
  const t0 = (d.vec3f(-3.75 - m, -0.65, -1.3 - m) - lo) * inv;
  const t1 = (d.vec3f(4.0 + m, 3.7 + m, 1.3 + m) - lo) * inv;
  const tmin = std.min(t0, t1);
  const tmax = std.max(t0, t1);
  return d.vec2f(std.max(std.max(tmin.x, tmin.y), tmin.z), std.min(std.min(tmax.x, tmax.y), tmax.z));
};

/** March a world ray against the ship. (t, material, coverage, 0): coverage < 1 on the soft edge of a defocused ship. */
const marchShip = (ro: d.v3f, rd: d.v3f, tMax: number): d.v4f => {
  'use gpu';
  const u = L.$.u;
  const lo = toShip(ro);
  const ld = toShipDir(rd);
  const bl = std.max(u.dof, u.pixA * 0.6);
  const m = bl * std.length(lo - d.vec3f(0, 1.5, 0)) * 1.3;
  const bb = shipBox(lo, ld, m);
  let out = d.vec4f(-1, 0, 0, 0);
  const tEnd = std.min(bb.y, tMax / u.shipS);
  if (u.shipOn > 0.001 && tEnd > std.max(bb.x, 0)) {
    let t = std.max(bb.x, 0);
    let minR = d.f32(1000);
    let tm = t;
    let mm = d.f32(1);
    for (let i = 0; i < 56; i++) {
      const h = mapShip(lo + ld * t);
      const r = h.x / t;
      if (r < minR && h.y > 0.5) {
        minR = r;
        tm = t;
        mm = h.y;
      }
      if (h.y > 0.5 && h.x < 0.0008 + t * std.max(u.pixA * 0.45, u.dof * 0.35)) {
        out = d.vec4f(t, h.y, 1, 0);
        break;
      }
      t += std.max(h.x * 0.8, t * std.max(u.pixA * 0.35, u.dof * 0.3) + 0.01);
      if (t > tEnd) {
        break;
      }
    }
    if (out.z < 0.5) {
      const cov = 1 - std.smoothstep(0, bl, minR);
      if (cov > 0.002) {
        out = d.vec4f(tm, mm, cov, 0);
      }
    }
    out = d.vec4f(out.x * u.shipS, out.y, out.z * std.clamp(u.shipOn, 0, 1), 0);
  }
  return out;
};

const shipNormal = (p: d.v3f): d.v3f => {
  'use gpu';
  const e = 0.004;
  const a = mapShip(p + d.vec3f(e, -e, -e)).x;
  const b = mapShip(p + d.vec3f(-e, -e, e)).x;
  const c = mapShip(p + d.vec3f(-e, e, -e)).x;
  const f = mapShip(p + d.vec3f(e, e, e)).x;
  return std.normalize(d.vec3f(e, -e, -e) * a + d.vec3f(-e, -e, e) * b + d.vec3f(-e, e, -e) * c + d.vec3f(e, e, e) * f);
};

const shipAO = (p: d.v3f, n: d.v3f): number => {
  'use gpu';
  let occ = d.f32(0);
  let sca = d.f32(1);
  for (let i = 0; i < 2; i++) {
    const hh = 0.05 + 0.16 * d.f32(i);
    const dd = mapShip(p + n * hh).x;
    occ += (hh - dd) * sca;
    sca *= 0.7;
  }
  return std.clamp(1 - 1.5 * occ, 0, 1);
};

/** Container colour for (cell paint, tier): one of six paint jobs. */
const boxColour = (paint: number, tier: number): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const hc = std.floor(std.fract(paint / std.pow(6, tier + 1)) * 6 + 0.01);
  let c = d.vec3f(u.cg);
  c = std.select(c, u.cb, hc > 0.5);
  c = std.select(c, u.ca, hc > 1.5);
  c = std.select(c, u.cc, hc > 2.5);
  c = std.select(c, u.cs, hc > 3.5);
  c = std.select(c, u.ck, hc > 4.5);
  return c;
};

/** Albedo (rgb) and window glow (w) of the ship at local point pl with local normal nl. */
const shipAlbedo = (pl: d.v3f, nl: d.v3f, mat: number, fp: number): d.v4f => {
  'use gpu';
  const u = L.$.u;
  let alb = d.vec3f(u.hullC);
  let glow = d.f32(0);
  if (mat < 1.5) {
    // hull: boot stripe at the waterline, slate body, cream gunwale, painted eyes at the bow
    const boot = std.smoothstep(0.17, 0.15, pl.y);
    const gun = std.smoothstep(0.53, 0.56, pl.y);
    alb = std.mix(u.hullC, u.cb * 0.9, boot);
    alb = std.mix(alb, u.cc, gun);
    const seam = std.smoothstep(0.012, 0.0, std.abs(std.fract(pl.x * 0.9) - 0.5) - 0.48);
    alb = alb * (1 - 0.18 * seam * (1 - gun) * (1 - boot));
    const side = std.smoothstep(0.35, 0.6, std.abs(nl.z));
    const er = std.length(d.vec2f((pl.x - 2.3) * 1.0, (pl.y - 0.34) * 1.0));
    const eye = std.smoothstep(0.2, 0.185, er) * side * (1 - std.smoothstep(0.03, 0.09, fp));
    const pup = std.smoothstep(0.1, 0.085, std.length(d.vec2f(pl.x - 2.34, pl.y - 0.33)));
    alb = std.mix(alb, u.cc * 1.1, eye);
    alb = std.mix(alb, u.ck * 0.12, pup * side);
  } else if (mat < 3.5) {
    // deckhouse: cream, with warm windows
    alb = u.cc * 0.95;
    const wall = 1 - std.smoothstep(0.3, 0.55, std.abs(nl.y));
    const band = std.max(std.smoothstep(0.03, 0.0, std.abs(pl.y - 1.18) - 0.16), std.max(std.smoothstep(0.03, 0.0, std.abs(pl.y - 2.12) - 0.13), std.smoothstep(0.03, 0.0, std.abs(pl.y - 2.66) - 0.1)));
    const alongX = std.fract((pl.x + 3.6) * 2.4);
    const alongZ = std.fract((pl.z + 1.1) * 2.0);
    const sideW = std.smoothstep(0.1, 0.16, alongX) * std.smoothstep(0.9, 0.84, alongX);
    const frontW = std.smoothstep(0.1, 0.16, alongZ) * std.smoothstep(0.9, 0.84, alongZ);
    const isSide = std.smoothstep(0.4, 0.7, std.abs(nl.z));
    const win = band * wall * std.mix(frontW, sideW, isSide) * std.step(pl.x, -2.25) * std.step(-3.55, pl.x);
    glow = win;
    alb = std.mix(alb, u.winC * 0.35, win);
    // a green stripe around the lower house
    alb = std.mix(alb, u.cg * 0.9, std.smoothstep(0.02, 0.0, std.abs(pl.y - 0.85) - 0.07) * wall);
  } else if (mat < 4.5) {
    // funnel: sprout green, cream band, dark cap, a cream sprout mark on the sides
    alb = u.cg * 0.95;
    alb = std.mix(alb, u.cc, std.smoothstep(0.02, 0.0, std.abs(pl.y - 2.32) - 0.09));
    alb = std.mix(alb, u.ck * 0.15, std.smoothstep(3.3, 3.34, pl.y));
    const mk = d.vec2f(pl.x + 3.25, pl.y - 2.78);
    const stem = std.length(d.vec2f(mk.x, std.max(std.abs(mk.y + 0.1) - 0.1, 0))) - 0.032;
    const arm1 = sdSeg2(mk, d.vec2f(0, -0.02), d.vec2f(-0.15, 0.16)).x - 0.03;
    const arm2 = sdSeg2(mk, d.vec2f(0, -0.02), d.vec2f(0.15, 0.16)).x - 0.03;
    const mark = std.smoothstep(0.012, 0.0, std.min(stem, std.min(arm1, arm2))) * std.smoothstep(0.35, 0.6, std.abs(nl.z));
    alb = std.mix(alb, u.cc, mark);
  } else if (mat < 5.5) {
    // container: colour per (cell, tier), ribs on the sides, door bars on the ends, a crease between tiers
    const i = std.floor(pl.x - CX0);
    const j = std.floor(pl.z / CW + 1.5);
    const tier = std.clamp(std.floor((pl.y - DECK) / CH + 0.02), 0, 2);
    alb = boxColour(cellMeta(i, j).z, tier);
    const hv = hash21(d.vec2f(i * 3.1 + tier * 7.7, j * 1.7 + 9.3));
    alb = alb * (0.9 + 0.2 * hv);
    const sideF = std.smoothstep(0.5, 0.8, std.abs(nl.z));
    const endF = std.smoothstep(0.5, 0.8, std.abs(nl.x));
    const rib = std.sin(pl.x * 24) * 0.5 + 0.5;
    alb = alb * (1 - sideF * 0.13 * rib * (1 - std.smoothstep(0.014, 0.035, fp)));
    const dz = std.abs(std.fract(pl.z / CW + 0.5) - 0.5) * CW;
    const bars = std.max(std.smoothstep(0.012, 0.0, std.abs(dz - 0.12) - 0.012), std.smoothstep(0.01, 0.0, dz - 0.008));
    alb = alb * (1 - endF * 0.28 * bars);
    const fy = std.fract((pl.y - DECK) / CH);
    const crease = std.smoothstep(0.035, 0.0, std.min(fy, 1 - fy));
    alb = alb * (1 - 0.35 * crease);
  } else if (mat < 6.5) {
    alb = u.cb * 0.35 * (0.8 + 0.4 * noise(d.vec2f(pl.x * 40, pl.z * 40)));
  } else if (mat < 7.5) {
    alb = u.cg * 0.75;
  } else if (mat < 8.5) {
    alb = std.mix(u.cg, d.vec3f(0.3, 0.75, 0.15), 0.35) * 1.15;
  } else {
    alb = u.cg * 1.05;
  }
  return d.vec4f(alb, glow);
};

/** Shading of the ship at world point pw. br = defocus radius in metres at that distance (colour taps). */
const shadeShip = (pw: d.v3f, rd: d.v3f, mat: number, tHit: number, hz: d.v3f, cov: number): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const pl = toShip(pw);
  const nl = shipNormal(pl);
  const n = std.normalize(shipToWorldDir(nl));
  const fp = tHit * u.pixA / u.shipS;
  const br = tHit * u.dof * 0.5 / u.shipS;
  let al = shipAlbedo(pl, nl, mat, fp + br);
  if (br > 0.015) {
    // defocus: average the paint over a small disc in the surface plane
    const tx = std.normalize(std.cross(nl, d.vec3f(0, 1, 0.0001)));
    const ty = std.cross(nl, tx);
    const a1 = shipAlbedo(pl + tx * br, nl, mat, fp + br);
    const a2 = shipAlbedo(pl - tx * br, nl, mat, fp + br);
    const a3 = shipAlbedo(pl + ty * br, nl, mat, fp + br);
    const a4 = shipAlbedo(pl - ty * br, nl, mat, fp + br);
    al = (al + a1 + a2 + a3 + a4) / 5;
  }
  const alb = d.vec3f(al.x, al.y, al.z);
  let ao = d.f32(1);
  if (br < 0.03) {
    ao = std.mix(1, shipAO(pl, nl), 1 - std.clamp(br * 30, 0, 1));
  }
  // wrapped sun, hemisphere sky, bounce off the sea
  const dif = std.clamp((std.dot(n, u.sun) + 0.35) / 1.35, 0, 1);
  const back = std.max(std.dot(rd, u.sun), 0);
  const up = std.mix(u.hor, u.mid, 0.5);
  const hemi = std.mix(u.hor * 0.45 + u.deep * 0.5, up * 1.1, n.y * 0.5 + 0.5);
  const amb = std.mix(hemi, d.vec3f(0.36, 0.4, 0.5) * std.mix(1.0, 1.5, u.light), 0.6);
  let col = alb * (u.sunC * u.sunI * dif * dif * 0.8 + amb * ao * std.mix(1.9, 0.78, u.light));
  const fr = std.pow(1 - std.max(std.dot(n, rd * -1), 0), 3);
  col = col + u.sunC * u.sunI * fr * std.pow(back, 3) * 0.6 * ao * cov * cov * cov;
  col = col + alb * u.scat * std.max(-n.y, 0) * 0.5;
  // leaves: low sun through them
  if (mat > 7.5 && mat < 8.5) {
    col = col + (u.leafT * u.sunC * u.sunI * std.pow(back, 2.5) * 0.5 * std.mix(1, 0.3, u.light) + u.leaf * 0.25) * cov * cov;
  }
  // windows glow
  col = std.mix(col, u.winC * (1.6 - 0.9 * u.light), al.w);
  const fog = 1 - std.exp(-tHit * u.fogK);
  return std.mix(col, hz, std.clamp(fog * std.mix(0.6, 0.14, u.light), 0, 0.9));
};

/** Steam: soft round puffs rising from the funnel and drifting aft. (rgb, alpha) */
const smokeAt = (ro: d.v3f, rd: d.v3f): d.v4f => {
  'use gpu';
  const u = L.$.u;
  let out = d.vec4f(0);
  const ctr = u.shipPos + (u.shipX * -4.8 + u.shipY * 4.3) * u.shipS;
  const oc0 = ctr - ro;
  const t0 = std.dot(oc0, rd);
  const dd0 = std.length(oc0 - rd * t0);
  if (u.smoke > 0.001 && t0 > 0 && dd0 < 3.0 * u.shipS) {
    let acc = d.f32(0);
    for (let i = 0; i < 7; i++) {
      const fi = d.f32(i);
      const a = std.fract(u.time * 0.1 + fi / 7);
      const lp = d.vec3f(-3.25 - a * 3.0 - 0.3 * a * a, 3.4 + a * 2.0, std.sin(fi * 5.1 + a * 2.5) * 0.3 * a);
      const c = u.shipPos + (u.shipX * lp.x + u.shipY * lp.y + u.shipZ * lp.z) * u.shipS;
      const r = (0.26 + 0.55 * a) * u.shipS;
      const oc = c - ro;
      const tc = std.dot(oc, rd);
      const dist = std.length(oc - rd * tc);
      const fade = std.smoothstep(0.0, 0.1, a) * (1 - std.smoothstep(0.55, 1.0, a));
      const dn = std.smoothstep(1, 0.7, dist / r) * fade * 0.95;
      acc = acc + dn * (1 - acc);
    }
    const mu = std.max(std.dot(rd, u.sun), 0);
    const base = std.mix(u.cloudShd, u.cloudLit, std.clamp(0.5 + std.pow(mu, 3) * 0.7, 0, 1)) * 1.15;
    const col = std.mix(base, horizCol(rd), 0.25);
    out = d.vec4f(col, std.clamp(acc, 0, 0.85) * u.smoke * std.clamp(u.shipOn, 0, 1));
  }
  return out;
};

/** The ship's reflection: its side as a flat cut-out (hull, house, funnel, the middle column of stacks), found where the
 *  reflected ray crosses the ship's centre plane. (rgb, weight) */
const shipCut = (ps: d.v3f, rr: d.v3f): d.v4f => {
  'use gpu';
  const u = L.$.u;
  const slo = toShip(ps);
  const sld = toShipDir(rr);
  let out = d.vec4f(0);
  if (std.abs(sld.z) > 0.0001) {
    const tz = -slo.z / sld.z;
    const q = slo + sld * tz;
    if (tz > 0 && q.x > -3.6 && q.x < 3.9 && q.y > 0 && q.y < 3.45) {
      let mat = d.f32(0);
      if (q.y < DECK) {
        mat = 1;
      }
      if (q.x < -2.33 && q.x > -3.55 && q.y < 1.8) {
        mat = 3;
      }
      if (q.x < -2.5 && q.x > -3.5 && q.y > 1.8 && q.y < 2.44) {
        mat = 3;
      }
      if (q.x < -2.26 && q.x > -2.98 && q.y > 2.44 && q.y < 2.86) {
        mat = 3;
      }
      if (q.x < -2.99 && q.x > -3.51 && q.y > 1.8 && q.y < 3.4) {
        mat = 4;
      }
      const n = cellMeta(std.floor(q.x - CX0), d.f32(1)).x;
      if (q.y > DECK && q.y < DECK + n * CH && q.x > CX0 && q.x < CX0 + 5) {
        mat = 5;
      }
      if (mat > 0.5) {
        const pl = d.vec3f(q.x, q.y, 0);
        const al = shipAlbedo(pl, d.vec3f(0, 0, 1), mat, 0.06);
        const amb = std.mix(u.deep * 0.5 + u.hor * 0.4, u.mid, 0.5) * 1.4 + d.vec3f(0.06);
        const sbase = d.vec3f(al.x, al.y, al.z) * amb;
        const col = std.mix(sbase, u.winC * 1.2, al.w) * 0.85 + u.deep * 0.12;
        out = d.vec4f(col, std.exp(-q.y * 0.12) * 0.92);
      }
    }
  }
  return out;
};

// ============================================================================================= sea shading
/** 2D distance from a sea point (raft-local xz) to the two logs' waterline footprint. */
const hullDist = (lx: number, lz: number): number => {
  'use gpu';
  const a = d.vec2f(std.abs(lx - 0.06) - 0.56, std.abs(lz + LOG_Z) - LOG_R * 0.97);
  const b = d.vec2f(std.abs(lx + 0.05) - 0.53, std.abs(lz - LOG_Z) - LOG_R * 0.97);
  const da = std.length(std.max(a, d.vec2f(0))) + std.min(std.max(a.x, a.y), 0);
  const db = std.length(std.max(b, d.vec2f(0))) + std.min(std.max(b.x, b.y), 0);
  return std.min(da, db);
};

const seaShade = (ps: d.v3f, rd: d.v3f, tS: number, under: d.v3f, underAmt: number, hz: d.v3f): d.v3f => {
  'use gpu';
  const u = L.$.u;
  const foot = tS * u.pixA / std.max(-rd.y, 0.035) * 0.55;
  const w = seaWaves(ps.x, ps.z, foot);
  let gx = w.y;
  let gz = w.z;
  // hull proximity: contact darkening, meniscus, bob ripples
  const q = ps - u.raftPos;
  const lx = std.dot(q, u.raftX);
  const lz = std.dot(q, u.raftZ);
  let contact = d.f32(1);
  let menis = d.f32(0);
  if (std.abs(lx) < 2.2 && std.abs(lz) < 1.8) {
    const hd = std.max(hullDist(lx, lz), 0);
    const e = 0.01;
    const hdx = (std.max(hullDist(lx + e, lz), 0) - hd) / e;
    const hdz = (std.max(hullDist(lx, lz + e), 0) - hd) / e;
    const gdir = u.raftX * hdx + u.raftZ * hdz;
    const rip = std.cos(hd * 48 - u.time * 4.2) * std.exp(-hd / 0.22) * (0.05 + u.wake) * std.clamp(1.6 - foot * 48 * 0.55, 0, 1);
    gx += gdir.x * rip;
    gz += gdir.z * rip;
    contact = 1 - 0.32 * std.exp(-hd / 0.05);
    menis = std.exp(-(hd * hd) / 0.00012) * std.clamp(1 - foot * 60, 0, 1);
  }
  // the ship's wake: a skirt of foam on the hull, two ridges leaving the bow, a turbulent trail astern
  let foam = d.f32(0);
  const sq = (ps - u.shipPos) / u.shipS;
  const sxl = std.dot(sq, u.shipX);
  const szl = std.dot(sq, u.shipZ);
  if (u.shipOn > 0.001 && sxl > -17 && sxl < 5.5 && std.abs(szl) < 9) {
    const w0 = hullHalf(sxl, 0);
    const outX = std.max(std.max(-3.6 - sxl, sxl - 3.9), 0);
    const dh = std.length(d.vec2f(std.max(std.abs(szl) - w0, 0) * 0.16, outX));
    const xa = sxl + 1.2 * u.time;
    const lod = std.clamp(1.6 - foot * 6 * 0.55 / u.shipS, 0, 1);
    const n1 = noise(d.vec2f(xa * 2.3, szl * 3.1 + 5.0));
    const skirt = std.exp(-dh / 0.2) * (0.65 + 0.7 * n1);
    const a = std.max(3.9 - sxl, 0);
    const zr = 1.5 + 0.7 * a;
    const rw = 0.35 + 0.1 * a;
    const ezr = std.abs(szl) - zr;
    const n2 = noise(d.vec2f(xa * 1.7, szl * 2.2 + a * 0.5 + 11.0));
    const ridge = std.exp(-(ezr * ezr) / (rw * rw)) * std.exp(-a / 7) * std.smoothstep(0.2, 1.2, a) * (0.3 + 1.0 * n2);
    const s = std.max(-3.4 - sxl, 0);
    const hw = 1.5 + 0.35 * s;
    const n3 = noise(d.vec2f(xa * 1.4, szl * 5.3 + 3.0));
    const n4 = noise(d.vec2f(xa * 0.6 + 7.0, szl * 9.0));
    const trail = std.exp(-(szl * szl) / (hw * hw) * 1.3) * std.exp(-s / 7.5) * std.smoothstep(0.0, 0.7, s) * (0.2 + 0.75 * n3 + 0.45 * n4);
    foam = std.smoothstep(0.22, 0.75, skirt + ridge * 0.9 + trail) * lod * std.clamp(u.shipOn, 0, 1);
    // the water heaves around the hull
    const rp = std.cos(dh * 6 - u.time * 3) * std.exp(-dh / 1.2) * 0.07 * lod;
    const gd = u.shipZ * std.sign(szl);
    gx += gd.x * rp;
    gz += gd.z * rp;
    contact = contact * (1 - 0.3 * std.exp(-dh / 0.3));
  }
  // capillary ripples near the camera: break broad highlights into many small glints (fade with the footprint)
  const cap = std.clamp(1.6 - foot * 40 * 0.55, 0, 1) * 0.05;
  if (cap > 0) {
    // value-noise gradients (no lattice), two octaves drifting in different directions
    const cp = d.vec2f(ps.x * 9, ps.z * 13) + d.vec2f(u.time * 0.7, u.time * 1.1);
    const n0 = noise(cp);
    const gxa = noise(cp + d.vec2f(0.3, 0)) - n0;
    const gza = noise(cp + d.vec2f(0, 0.3)) - n0;
    const cq = d.vec2f(ps.x * 21 + 7.3, ps.z * 29 + 1.9) + d.vec2f(-u.time * 1.3, u.time * 1.7);
    const m0 = noise(cq);
    const gxb = noise(cq + d.vec2f(0.3, 0)) - m0;
    const gzb = noise(cq + d.vec2f(0, 0.3)) - m0;
    gx += cap * (gxa + gxb * 0.6) / 0.3;
    gz += cap * (gza + gzb * 0.6) / 0.3;
  }
  const n = std.normalize(d.vec3f(-gx, 1, -gz));
  const cosi = std.max(std.dot(n, rd * -1), 0);
  const F = 0.02 + 0.98 * std.pow(1 - cosi, 5);
  let rf = std.reflect(rd, n);
  rf = std.normalize(d.vec3f(rf.x, std.max(std.abs(rf.y), 0.002), rf.z));
  let refl = skyBase(rf);
  const isl = islandAt(ps, rf, d.f32(4));
  if (isl.x > 0) {
    refl = std.mix(refl, islandShade(horizCol(rf), isl), isl.x);
  }
  // the raft in the water: reflected through exaggerated normals (so the waves break it up), fading with the
  // reflected point's height above the waterline, tinted by the water
  const nr = std.normalize(d.vec3f(-gx * 2.2, 1, -gz * 2.2));
  let rr = std.reflect(rd, nr);
  rr = std.normalize(d.vec3f(rr.x, std.max(std.abs(rr.y), 0.002), rr.z));
  const rh = marchRaft(ps + d.vec3f(0, 0.004, 0), rr, d.f32(36), d.f32(1000));
  if (rh.x > 0) {
    const pr = ps + rr * rh.x;
    const fadeR = std.exp(-std.max(pr.y - u.raftPos.y + 0.03, 0) * 3.2) * 0.9;
    const rc = shadeRaftLite(pr, rr, rh.y) * 0.8 + u.deep * 0.18 + u.scat * 0.04;
    refl = std.mix(refl, rc, fadeR);
  }
  // the ship in the water: a flat cut-out of its side seen along the (wobbled) reflected ray
  if (u.shipOn > 0.001) {
    const sc = shipCut(ps, rr);
    refl = std.mix(refl, d.vec3f(sc.x, sc.y, sc.z), sc.w * std.clamp(u.shipOn, 0, 1));
  }
  // body: deep water + light scattered through wave crests toward the sun
  const fwd = std.pow(std.max(std.dot(std.normalize(d.vec3f(rd.x, 0, rd.z)), std.normalize(d.vec3f(u.sun.x, 0, u.sun.z))), 0), 3);
  const crest = std.clamp(w.x * 9 + 0.45, 0, 1.3);
  let body = u.deep * (0.8 + 0.2 * crest) + u.scat * u.sunI * fwd * crest * 0.22;
  body = std.mix(body, under, underAmt);
  let col = std.mix(body, refl, std.clamp(F, 0, 1)) * contact;
  // sun glitter: a tight lobe near, wider with distance (keeps the path continuous, never aliased)
  // anisotropic (slope-space gaussian): glints long across the view and thin toward it, tighter near, wider far
  const hv = std.normalize(u.sun - rd);
  const fwdH = std.normalize(d.vec3f(rd.x, 0, rd.z));
  const sideH = d.vec3f(-fwdH.z, 0, fwdH.x);
  const hn = std.max(std.dot(hv, n), 0.05);
  const es = hv / hn - n;
  const ex = std.dot(es, sideH);
  const ez = std.dot(es, fwdH);
  const kf = std.clamp(foot * 5, 0, 1);
  const ax = std.mix(0.045, 0.12, kf);
  const az = std.mix(0.008, 0.085, kf);
  const spec = std.exp(-(ex * ex / (ax * ax) + ez * ez / (az * az))) * (0.01 / (ax * az)) * std.smoothstep(1.5, 7, tS) * (0.02 + 0.98 * std.pow(1 - std.max(std.dot(hv, rd * -1), 0), 5));
  col = col + std.mix(u.glow, u.sunC, 0.6) * u.sunI * spec * 0.8 * contact;
  col = col + refl * menis * 0.22;
  // foam: sky-lit white
  const foamC = (u.cc * 0.8 + hz * 0.6) * std.mix(0.85, 1.05, u.light) + u.sunC * u.sunI * 0.1;
  col = std.mix(col, foamC, foam * 0.85);
  // aerial perspective into the horizon colour (the same colour the sky has at elevation 0)
  const fog = 1 - std.exp(-tS * u.fogK);
  return std.mix(col, hz, std.clamp(fog, 0, 1));
};

// ============================================================================================= frame
const tonemap = (c: d.v3f): d.v3f => {
  'use gpu';
  const a = 0.72;
  const x = std.max(c, d.vec3f(0));
  const over = std.max(x - a, d.vec3f(0));
  return std.min(x, d.vec3f(a)) + (1 - std.exp(over * (-1 / (1 - a)))) * (1 - a);
};

export const duskFrag = tgpu.fragmentFn({ in: { uv: d.vec2f, pos: d.builtin.position }, out: d.vec4f })((input) => {
  'use gpu';
  const u = L.$.u;
  const p = d.vec2f((input.uv.x - 0.5) * u.aspect, 0.5 - input.uv.y);
  const m = maskAll(p, u.mask0, u.mask1, u.mask2, u.mask3, u.maskK, u.aspect);
  const ro = d.vec3f(u.camPos);
  const rd = std.normalize(u.camF * u.focal + u.camR * p.x + u.camU * p.y);
  const hz = horizCol(rd);
  let col = d.vec3f(0);
  const tFloor = std.select(d.f32(1000), (-0.16 - ro.y) / std.min(rd.y, -0.0001), rd.y < 0);
  let hit = d.vec2f(-1, 0);
  hit = marchRaft(ro, rd, d.f32(72), tFloor);
  // one call site per expensive function: 0 sky, 1 sea, 2 raft
  let mode = d.f32(0);
  let tS = d.f32(0);
  let under = d.vec3f(u.deep);
  let underAmt = d.f32(0);
  let wh = d.f32(0);
  if (rd.y < 0) {
    mode = 1;
    tS = -ro.y / rd.y;
  }
  if (hit.x > 0) {
    const pw = ro + rd * hit.x;
    wh = seaWaves(pw.x, pw.z, d.f32(0)).x;
    if (pw.y > wh) {
      mode = 2;
    } else if (rd.y < 0) {
      // under the waterline: seen through the surface, darkened and tinted with depth
      tS = (wh - ro.y) / rd.y;
      const depth = wh - pw.y;
      under = std.mix(u.deep, shadeRaftLite(pw, rd, hit.y) * u.scat * 2.2, std.exp(-depth * 12));
      underAmt = std.exp(-depth * 8) * 0.6 * std.smoothstep(-0.155, -0.08, pw.y);
    }
  }
  if (mode > 1.5) {
    col = shadeRaft(ro + rd * hit.x, rd, hit.y, wh);
  } else {
    let isl = d.vec4f(0);
    if (rd.y > -0.03) { isl = islandAt(ro, rd, d.f32(1)); }
    if (isl.x < 0.999) {
      if (mode > 0.5) {
        col = seaShade(ro + rd * tS, rd, tS, under, underAmt, hz);
      } else {
        col = clouds(rd, skyBase(rd)) + sunDisk(rd) + d.vec3f(stars(rd) * std.clamp(1 - m * 5, 0, 1));
      }
    }
    if (isl.x > 0) {
      col = std.mix(col, islandShade(hz, isl), isl.x);
    }
  }
  // veiling glare from the sun over everything (soft bloom), and a whisper of vignette
  const mu = std.max(std.dot(rd, u.sun), 0);
  col = col + u.glow * u.sunI * u.glare * (std.pow(mu, 30) * 0.012 + std.pow(mu, 300) * 0.1);
  const vg = 1 - 0.12 * std.pow(std.length(d.vec2f(p.x / std.max(u.aspect, 0.6), p.y)) * 1.15, 2.5);
  col = tonemap(col * vg);
  col = std.mix(col, u.canvas, m);
  return d.vec4f(encode(col) + dither(d.vec2f(input.pos.x, input.pos.y)), 1);
});

/** The ship: its own pass over its own screen rectangle, premultiplied over the scene. Same output stage as the scene
 *  (glare, vignette, tonemap, contrast mask, sRGB), so the two meet without a seam; it keeps the heavy ship code (and
 *  its registers) out of the scene pass. */
export const shipFrag = tgpu.fragmentFn({ in: { uv: d.vec2f, pos: d.builtin.position }, out: d.vec4f })((input) => {
  'use gpu';
  const u = L.$.u;
  const p = d.vec2f((input.uv.x - 0.5) * u.aspect, 0.5 - input.uv.y);
  const ro = d.vec3f(u.camPos);
  const rd = std.normalize(u.camF * u.focal + u.camR * p.x + u.camU * p.y);
  const tSea = std.select(d.f32(1000), -ro.y / rd.y, rd.y < 0);
  const hit = marchShip(ro, rd, tSea);
  let cov = std.select(d.f32(0), hit.z, hit.x > 0);
  if (cov > 0.001) {
    // the raft is nearer than the ship wherever both are in the way
    const tFloor = std.select(d.f32(1000), (-0.16 - ro.y) / std.min(rd.y, -0.0001), rd.y < 0);
    const rh = marchRaft(ro, rd, d.f32(72), tFloor);
    if (rh.x > 0 && rh.x < hit.x) {
      cov = 0;
    }
  }
  const smk = smokeAt(ro, rd);
  let rgb = d.vec3f(0);
  if (cov > 0.001 || smk.w > 0.001) {
    // the contrast mask protects the copy: sharp, the ship sits below it and needs little; defocused, it sits behind it
    const m = maskAll(p, u.mask0, u.mask1, u.mask2, u.mask3, u.maskK, u.aspect) * std.mix(0.35, 1, std.clamp(u.dof * 100, 0, 1));
    const mu = std.max(std.dot(rd, u.sun), 0);
    const glare = u.glow * u.sunI * u.glare * (std.pow(mu, 30) * 0.012 + std.pow(mu, 300) * 0.1);
    const vg = 1 - 0.12 * std.pow(std.length(d.vec2f(p.x / std.max(u.aspect, 0.6), p.y)) * 1.15, 2.5);
    let shipCol = d.vec3f(0);
    if (cov > 0.001) {
      const c0 = shadeShip(ro + rd * hit.x, rd, hit.y, hit.x, horizCol(rd), cov) + glare;
      shipCol = std.mix(tonemap(c0 * vg), u.canvas, m);
    }
    let smkCol = d.vec3f(0);
    if (smk.w > 0.001) {
      smkCol = std.mix(tonemap((d.vec3f(smk.x, smk.y, smk.z) + glare) * vg), u.canvas, m);
    }
    rgb = smkCol * smk.w + shipCol * cov * (1 - smk.w);
  }
  const a = smk.w + cov * (1 - smk.w);
  return d.vec4f(encode(rgb) * a + dither(d.vec2f(input.pos.x, input.pos.y)) * a, a);
});

export { fullscreenVert };
