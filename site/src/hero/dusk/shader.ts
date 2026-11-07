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

export { fullscreenVert };
