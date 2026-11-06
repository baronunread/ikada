// WebGPU backend (TypeGPU). Three looks in one fragment shader, selected by a uniform.
// All colour maths happens in linear light; the canvas format is not sRGB, so the
// shader encodes to sRGB at the very end. Text contrast is guaranteed by the
// protection mask (up to four soft rounded rects that fade the field to the canvas
// colour), applied just before the encode.
//
// Vector arithmetic uses std.add/sub/mul/div instead of operators: the TGSL transpiler
// accepts `a + b` on vectors, but TypeScript cannot type it, and this file should pass
// a strict `tsc` in whichever project it lands in.
import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import { add, sub, mul, div } from 'typegpu/std';
import { createRuntime, PLANT_SLOTS, type FrameState, type Handle, type Opts, type Renderer } from './common';
import { PALETTE } from './palette';
import { MASK_FEATHER, MASK_RADIUS } from './mask';

const Uniforms = d.struct({
  res: d.vec2f,
  pointer: d.vec2f,     // canvas uv, y down (spring-smoothed)
  vel: d.vec2f,         // pointer velocity, canvas uv / s, y down (the follow spring's own velocity)
  time: d.f32,
  progress: d.f32,
  presence: d.f32,
  mode: d.u32,          // 0 caustics, 1 inkwash, 2 growth
  canvas: d.vec3f,      // linear sRGB: the page canvas colour (mask target)
  c0: d.vec3f,          // the five concept colours (slot meanings in palette-gen.ts)
  c1: d.vec3f,
  c2: d.vec3f,
  c3: d.vec3f,
  c4: d.vec3f,
  mask: d.arrayOf(d.vec4f, 4), // protection rects (x0, y0, x1, y1) in canvas uv
  maskK: d.vec4f,       // protection strength per rect
  plantN: d.u32,        // live plants (compacted to the front of plants)
  plants: d.arrayOf(d.vec4f, PLANT_SLOTS), // (u, v, age s, vis)
});
const layout = tgpu.bindGroupLayout({ u: { uniform: Uniforms } });

// --- noise helpers ----------------------------------------------------------

/** Dave Hoskins style hash: no sin(), so it stays stable on fast-math GPUs. */
const hash21 = (p: d.v2f): number => {
  'use gpu';
  let p3 = std.fract(mul(d.vec3f(p.x, p.y, p.x), 0.1031));
  p3 = add(p3, std.dot(p3, add(d.vec3f(p3.y, p3.z, p3.x), 33.33)));
  return std.fract((p3.x + p3.y) * p3.z);
};

const quintic = (x: number): number => {
  'use gpu';
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Value noise with quintic smoothing, 0..1. */
const noise = (p: d.v2f): number => {
  'use gpu';
  const i = std.floor(p);
  const f = std.fract(p);
  const w = d.vec2f(quintic(f.x), quintic(f.y));
  const a = hash21(i);
  const b = hash21(add(i, d.vec2f(1, 0)));
  const c = hash21(add(i, d.vec2f(0, 1)));
  const e = hash21(add(i, d.vec2f(1, 1)));
  return std.mix(std.mix(a, b, w.x), std.mix(c, e, w.x), w.y);
};

/** Rotate + scale by ~2 between octaves, with an offset so octaves do not line up. */
const octave = (p: d.v2f, ox: number, oy: number): d.v2f => {
  'use gpu';
  return d.vec2f(p.x * 1.6 - p.y * 1.2 + ox, p.x * 1.2 + p.y * 1.6 + oy);
};

/** fbm with `octaves` octaves, roughly 0..1 (mean ~0.5). */
const fbm = (p0: d.v2f, octaves: number): number => {
  'use gpu';
  let p = d.vec2f(p0);
  let v = d.f32(0);
  let amp = d.f32(0.5);
  for (let i = d.i32(0); i < octaves; i++) {
    v += amp * noise(p);
    p = octave(p, 1.7, 9.2);
    amp *= 0.5;
  }
  return v;
};

const hash22 = (p: d.v2f): d.v2f => {
  'use gpu';
  let p3 = std.fract(mul(d.vec3f(p.x, p.y, p.x), d.vec3f(0.1031, 0.103, 0.0973)));
  p3 = add(p3, std.dot(p3, add(d.vec3f(p3.y, p3.z, p3.x), 33.33)));
  return std.fract(mul(add(d.vec2f(p3.x, p3.x), d.vec2f(p3.y, p3.z)), d.vec2f(p3.z, p3.y)));
};

/** Animated Voronoi, F2 - F1: ~0 on the cell walls, where refracted light converges. */
const vorEdge = (p: d.v2f, t: number): number => {
  'use gpu';
  const i = std.floor(p);
  const f = std.fract(p);
  let f1 = d.f32(8);
  let f2 = d.f32(8);
  for (let y = d.i32(-1); y <= 1; y++) {
    for (let x = d.i32(-1); x <= 1; x++) {
      const g = d.vec2f(d.f32(x), d.f32(y));
      const h = hash22(add(i, g));
      const ph = add(mul(add(d.vec2f(0.55), mul(d.vec2f(h.y, h.x), 0.5)), t), mul(h, 6.2831));
      const o = add(d.vec2f(0.5), mul(std.sin(ph), 0.42));
      const r = sub(add(g, o), f);
      const dd = std.dot(r, r);
      if (dd < f1) {
        f2 = f1;
        f1 = dd;
      } else if (dd < f2) {
        f2 = dd;
      }
    }
  }
  return std.sqrt(f2) - std.sqrt(f1);
};

// --- the three looks --------------------------------------------------------
// Each returns a linear-light colour built from the five concept colours.

const caustics = (p: d.v2f, uvY: number, t: number, c0: d.v3f, c1: d.v3f, c2: d.v3f, c3: d.v3f, c4: d.v3f): d.v3f => {
  'use gpu';
  // Surface waves bend the cell walls; two nets at different scales and drifts interfere.
  let q = mul(p, 4.2);
  q = add(q, mul(d.vec2f(std.sin(q.y * 0.7 + t * 0.45) + 0.5 * std.sin(q.y * 1.9 - t * 0.31), std.sin(q.x * 0.6 - t * 0.38) + 0.5 * std.sin(q.x * 1.7 + t * 0.33)), 0.5));
  const e1 = vorEdge(add(q, d.vec2f(t * 0.05, -t * 0.03)), t * 0.9);
  const q2 = add(mul(d.vec2f(q.x * 0.8 - q.y * 0.6, q.x * 0.6 + q.y * 0.8), 1.7), 13.1);
  const e2 = vorEdge(add(q2, d.vec2f(-t * 0.04, t * 0.06)), t * 0.7);
  const l1 = std.exp(-e1 * 11);
  const l2 = std.exp(-e2 * 13);
  const glow = std.exp(-e1 * 3.2);
  const hot = l1 * l2;                                       // crossings: light focuses
  // Light shafts from above: slow broad bands that modulate the net.
  const ang = p.x + p.y * 0.45;
  const shaft = 0.6 + 0.4 * std.sin(ang * 2.6 + t * 0.12) * std.sin(ang * 1.3 - t * 0.09 + 1.7);
  const shade = std.smoothstep(0.08, 0.45, e1);              // cell interiors, away from the light
  const ground = std.mix(c0, c1, std.smoothstep(0, 1, uvY));
  let col = std.mix(ground, c4, shade * 0.55);
  col = std.mix(col, c2, std.saturate(glow * 0.55 * shaft));
  col = std.mix(col, c2, std.saturate((l1 * 0.9 + l2 * 0.55) * shaft));
  col = std.mix(col, c3, std.saturate((std.pow(l1, 2.2) * 0.8 + hot * 1.6) * shaft));
  return col;
};

const inkwash = (p: d.v2f, aspect: number, t: number, ptr: d.v2f, presence: number, c0: d.v3f, c1: d.v3f, c2: d.v3f, c3: d.v3f, c4: d.v3f): d.v3f => {
  'use gpu';
  // Pointer displaces the field within ~30 % of the width, gaussian falloff, pre-smoothed on the CPU.
  const dv = sub(p, ptr);
  const rad = 0.3 * aspect;
  const infl = std.exp(-std.dot(dv, dv) / (rad * rad * 0.5)) * presence;
  const q = add(p, mul(dv, infl * 0.35));
  // Far layer: one broad, slow cloud (depth); it is also one axis of the warp.
  const back = fbm(add(add(mul(q, 1.15), d.vec2f(t * 0.045, -t * 0.025)), 3.7), 3);
  // Near layer: a warped field that billows (the warp itself evolves with time).
  const a = add(mul(q, 1.9), d.vec2f(-t * 0.06, t * 0.035));
  const w1 = fbm(add(mul(a, 1.2), d.vec2f(5.2 + t * 0.07, 1.3 - t * 0.05)), 3);
  const n = fbm(add(a, mul(d.vec2f(w1 - 0.5, back - 0.5), 2.6)), 4);
  const edge = std.smoothstep(0.25, 0.95, std.length(d.vec2f((p.x / aspect) * 1.6, p.y * 1.5)));
  const dens = n + edge * 0.1 + infl * 0.12;
  const far = std.smoothstep(0.4, 0.7, back + edge * 0.15);
  const aa = std.fwidth(dens) * 1.5 + 0.004;
  const body = std.smoothstep(0.46 - aa, 0.46 + aa + 0.01, dens);
  const core = std.smoothstep(0.49, 0.74, dens);
  const rim = body * (1 - std.smoothstep(0, 0.05 + aa, dens - 0.46));
  // Wisps: ridges of the warp field just outside the ink, tendrils reaching into clear water.
  const ridge = 1 - std.abs(w1 * 2 - 1);
  const wisp = std.smoothstep(0.88, 0.98, ridge) * std.smoothstep(0.3, 0.46, dens) * (1 - body);
  // Sheen: a lighter band through the dense ink, following the warp (volume).
  const sheen = std.smoothstep(0.55, 0.9, w1) * core;
  let col = d.vec3f(c0);
  col = std.mix(col, c1, far * 0.85);
  col = std.mix(col, c4, far * std.smoothstep(0.6, 0.85, back) * 0.4);
  col = std.mix(col, c2, std.max(body * 0.9, wisp * 0.6));
  col = std.mix(col, c3, core * 0.9);
  col = std.mix(col, c3, rim * 0.6);
  col = std.mix(col, c4, sheen * 0.35);
  return col;
};

/** One planted sprout, analytic: N primary branches from the seed that fork twice on the way out (|||a| − δ1| − δ2| on
 *  the angle to the nearest branch), bent by the field's own noise so it reads as part of it. A growth front eases out
 *  over ~1.8 s with a glowing tip; a ripple and a seed bulb answer the press at once; after ~3 s it settles to the
 *  field's vein colours. Returns weights (body, shadow halo, bright core, tip + ripple), already × visibility. */
const PLANT_R = 0.17; // radius in hero heights (≈150 px on a 1440×871 hero, ≈125 px on a phone)
const sprout = (p: d.v2f, pl: d.v4f, aspect: number, px: number, n: number): d.v4f => {
  'use gpu';
  const c = d.vec2f((pl.x - 0.5) * aspect, 0.5 - pl.y);
  const rel = sub(p, c);
  const r2 = std.dot(rel, rel);
  const sc = std.min(1, 0.45 + aspect * 0.6);             // smaller on tall phone heroes
  const rMax = PLANT_R * 1.15 * 1.25 * sc;                // bounding radius (branch reach ≤ 1.21 R, ripple 1.2 R)
  let out = d.vec4f(0);
  if (r2 < rMax * rMax) {
    const r = std.sqrt(r2);
    const h = hash21(mul(d.vec2f(pl.x, pl.y), 917.3));
    const R = PLANT_R * (0.85 + 0.3 * h) * sc;
    const age = pl.z;
    const h2 = hash21(add(mul(d.vec2f(pl.y, pl.x), 613.7), 4.1));
    const k = std.saturate(age / 1.8);
    const grow = 1 - (1 - k) * (1 - k) * (1 - k);           // ease-out cubic: fast start, gentle arrival
    const N1 = 5 + std.floor(h2 * 2.99);
    const seg = 6.2831853 / N1;
    const r0 = r / R;
    const th = std.atan2(rel.y, rel.x) + (n - 0.5) * 1.2 * r0 + std.sin(r0 * 5 + h * 6.2831) * 0.24 * r0 + h2 * 6.2831;
    const local = (std.fract(th / seg) - 0.5) * seg;        // signed angle from the nearest primary branch
    // Each branch gets its own length, and up-facing ones reach further (a sprout, not a snowflake).
    const lenK = (0.55 + 0.45 * hash21(d.vec2f(std.floor(th / seg), h * 37.1))) * (0.8 + 0.3 * std.saturate(rel.y / std.max(r, 1e-4)));
    const Rs = R * lenK;
    const rn = r / Rs;
    const front = Rs * grow * (0.9 + 0.2 * n);              // fingered by the field noise
    const d1 = seg * 0.27 * std.smoothstep(0.28, 0.95, rn); // first fork
    const d2 = seg * 0.085 * std.smoothstep(0.62, 1.0, rn); // twigs
    const dist = std.abs(std.abs(std.abs(local) - d1) - d2) * r;
    const aa = px * 1.2;
    const w = R * std.mix(0.055, 0.011, std.saturate(rn)) + px * 0.4; // tapering
    const reveal = std.smoothstep(front + aa, front - Rs * 0.06, r);
    const kb = std.saturate(age / 0.35);
    const bulbR = R * 0.07 * std.min(kb * 1.6, 1) * (1 + 0.3 * std.sin(kb * 3.14159));
    const bulb = 1 - std.smoothstep(bulbR - aa, bulbR + aa, r);
    const body = std.max((1 - std.smoothstep(w - aa, w + aa, dist)) * reveal, bulb);
    const halo = std.max((1 - std.smoothstep(w, w * 3.5 + aa, dist)) * reveal, bulb);
    const fresh = 1 - std.smoothstep(1.2, 3.0, age);
    const core = std.max((1 - std.smoothstep(0, w * 0.5 + px * 0.5, dist)) * reveal, bulb * 0.8) * (0.35 + 0.65 * fresh);
    const fd = (r - front) / (Rs * 0.09);
    const tip = std.exp(-fd * fd) * (1 - std.smoothstep(w, w * 2.6 + aa, dist)) * fresh * std.step(0.02, grow);
    const kr = std.saturate(age / 0.7);
    const ringR = R * 1.2 * (1 - (1 - kr) * (1 - kr) * (1 - kr));
    const rd = (r - ringR) / (px * 2.5);
    const ring = std.exp(-rd * rd) * (1 - kr) * 0.7;
    const vis = pl.w * (0.75 + 0.25 * fresh);
    out = mul(d.vec4f(body, halo, core, std.saturate(tip + ring)), vis);
  }
  return out;
};

const growth = (p0: d.v2f, aspect: number, px: number, t: number, progress: number, ptr: d.v2f, vel: d.v2f, presence: number, guard: number, c0: d.v3f, c1: d.v3f, c2: d.v3f, c3: d.v3f, c4: d.v3f): d.v3f => {
  'use gpu';
  // Pointer: tendrils lean in (the domain is pinched toward the cursor), and the field is dragged along the cursor's
  // velocity (sampled from behind it), so a sweep leaves an eased wake that relaxes as the spring settles.
  const dv = sub(p0, ptr);
  const r2 = std.dot(dv, dv);
  const infl = std.exp(-r2 / (0.24 * 0.24)) * presence;
  const drag = std.exp(-r2 / (0.3 * 0.3)) * presence;
  const vp = d.vec2f(vel.x * aspect, -vel.y);
  const p = add(add(p0, mul(dv, 0.55 * infl)), mul(vp, -0.06 * drag));
  const tt = t * 0.03;                                    // slow drift when idle
  const seed = d.vec2f(0, -0.62);                         // just below bottom centre
  const q = add(mul(p, 2.0), d.vec2f(tt, tt * 0.6));
  // One large fbm doubles as domain warp, soft pools and the dim back veins.
  const big = fbm(add(mul(q, 0.55), d.vec2f(3.1, 7.7)), 3);
  const n = fbm(add(q, mul(d.vec2f(big - 0.5, 0.5 - big), 1.6)), 4);
  const rn = fbm(add(add(mul(q, 1.4), mul(d.vec2f(big, -big), 1.2)), 11), 3);
  const aa = std.fwidth(n);
  const fb = std.fwidth(big);
  // Back layer: soft, dim veins from the large field at offset levels (depth).
  const lvlB = std.abs(std.fract(big * 5 + 0.25) - 0.5) / 5;
  const backV = 1 - std.smoothstep(0, fb * 16 + 0.012, lvlB);
  // Trunks: tube-shaded contour lines (bright core) with a soft shadow halo.
  const lvlT = std.abs(std.fract(big * 3 + 0.5) - 0.5) / 3;
  const wT = (fb * 6 + 0.011) * (1 + 0.45 * infl);     // near the cursor the veins thicken: they grow toward it
  const trunk = 1 - std.smoothstep(wT * 0.7, wT, lvlT);
  const halo = 1 - std.smoothstep(wT, wT * 3.2, lvlT);
  const core = 1 - std.smoothstep(0, wT * 0.45, lvlT);
  // Capillaries (7 levels of the warped field) and ridged tendrils.
  const lvlC = std.abs(std.fract(n * 7 + 0.5) - 0.5) / 7;
  const wC = (aa * 1.8 + 0.003) * (1 + 0.9 * infl);
  const cap = 1 - std.smoothstep(wC * 0.4, wC, lvlC);
  const ra = std.fwidth(rn) * 1.5 + 0.003;
  const ridge = std.smoothstep(0.93 - ra, 0.935 + ra, 1 - std.abs(rn * 2 - 1));
  // Frontier: anisotropic distance from the seed (reach up more than out), fingered by fbm.
  const rel = sub(p, seed);
  const d0 = std.length(d.vec2f(rel.x * 1.5, rel.y));
  const dist = d0 + (n - 0.5) * 0.9 + (big - 0.5) * 0.4 - infl * 0.3; // the frontier reaches for the cursor
  const reach = progress * 2.0 + std.sin(t * 0.7) * 0.02 * progress;
  const grown = std.smoothstep(reach, reach - 0.18, dist);
  const along = std.saturate(dist / reach);
  const veinCol = std.mix(c2, c3, along);
  const pool = std.smoothstep(0.45, 0.8, big);
  const tip = std.smoothstep(reach - 0.5, reach - 0.08, dist) * grown;
  let col = std.mix(c0, c1, pool * 0.75 * grown);
  col = std.mix(col, std.mix(c1, c2, 0.45), backV * 0.55 * grown);
  col = std.mix(col, mul(c2, 0.55), halo * 0.22 * grown);
  col = std.mix(col, std.mix(c3, veinCol, 0.5), ridge * grown);
  col = std.mix(col, veinCol, cap * 0.85 * grown);
  col = std.mix(col, std.mix(c2, c3, along * 0.6), trunk * grown);
  col = std.mix(col, c4, core * 0.55 * grown);
  const vein = std.max(trunk, std.max(cap * 0.85, ridge));
  col = std.mix(col, c4, tip * (0.3 + vein * 0.7));
  col = std.mix(col, c4, vein * infl * 0.35 * grown);    // and light up a little where it leans in
  // Plants (soft union across the ring).
  let sp = d.vec4f(0);
  for (let i = d.u32(0); i < layout.$.u.plantN; i++) {
    sp = std.max(sp, sprout(p, layout.$.u.plants[i], aspect, px, n));
  }
  col = std.mix(col, mul(c2, 0.55), sp.y * 0.3);
  col = std.mix(col, std.mix(c2, c3, 0.6), sp.x * 0.92);
  // highlights (bright core, tips, ripple) are held back inside the text zones on top of the mask, for contrast headroom
  col = std.mix(col, c4, sp.z * 0.7 * guard);
  col = std.mix(col, c4, sp.w * guard);
  return col;
};

/** Soft capsule protection: k inside the zone, gaussian fade over MASK_FEATHER outside, so zones read as one glow. */
const rectMask = (p: d.v2f, r: d.v4f, k: number, aspect: number): number => {
  'use gpu';
  const c = d.vec2f(((r.x + r.z) * 0.5 - 0.5) * aspect, 0.5 - (r.y + r.w) * 0.5);
  const hs = d.vec2f((r.z - r.x) * 0.5 * aspect, (r.w - r.y) * 0.5);
  const rad = std.min(MASK_RADIUS, std.min(hs.x, hs.y));
  const q = sub(std.abs(sub(p, c)), sub(hs, rad));
  const dd = std.max(std.length(std.max(q, d.vec2f(0))) + std.min(std.max(q.x, q.y), 0) - rad, 0);
  const F = MASK_FEATHER * std.min(1, aspect * 0.85);
  return k * std.exp((-dd * dd) / (F * F * 0.33));
};

/** Linear -> sRGB transfer, per channel. */
const encode = (c: d.v3f): d.v3f => {
  'use gpu';
  const hiPart = sub(mul(std.pow(c, d.vec3f(1 / 2.4)), 1.055), 0.055);
  return std.select(hiPart, mul(c, 12.92), std.le(c, d.vec3f(0.0031308)));
};

export const vert = tgpu.vertexFn({ in: { idx: d.builtin.vertexIndex }, out: { pos: d.builtin.position, uv: d.vec2f } })((input) => {
  'use gpu';
  const x = d.f32((input.idx << 1) & 2);
  const y = d.f32(input.idx & 2);
  return { pos: d.vec4f(x * 2 - 1, 1 - y * 2, 0, 1), uv: d.vec2f(x, y) };
});

export const frag = tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
  'use gpu';
  const u = layout.$.u;
  const aspect = u.res.x / u.res.y;
  // Aspect-corrected space: y up, height = 1, centred.
  const p = d.vec2f((input.uv.x - 0.5) * aspect, 0.5 - input.uv.y);
  const ptr = d.vec2f((u.pointer.x - 0.5) * aspect, 0.5 - u.pointer.y);
  // Soft union of the protection zones (1 - product of the complements): overlaps merge into one glow.
  const m = 1 - (1 - rectMask(p, u.mask[0], u.maskK.x, aspect)) * (1 - rectMask(p, u.mask[1], u.maskK.y, aspect))
              * (1 - rectMask(p, u.mask[2], u.maskK.z, aspect)) * (1 - rectMask(p, u.mask[3], u.maskK.w, aspect));
  let col = d.vec3f(u.canvas);
  if (u.mode === 0) {
    col = caustics(p, input.uv.y, u.time, u.c0, u.c1, u.c2, u.c3, u.c4);
  } else if (u.mode === 1) {
    col = inkwash(p, aspect, u.time, ptr, u.presence, u.c0, u.c1, u.c2, u.c3, u.c4);
  } else {
    col = growth(p, aspect, 1 / u.res.y, u.time, u.progress, ptr, u.vel, u.presence, 1 - m, u.c0, u.c1, u.c2, u.c3, u.c4);
  }
  col = std.mix(col, u.canvas, m);
  const e = encode(col);
  return d.vec4f(e.x, e.y, e.z, 1);
});

// --- runtime ----------------------------------------------------------------

export async function mount(canvas: HTMLCanvasElement, opts: Opts): Promise<Handle | null> {
  const root = await tgpu.init({ device: { optionalFeatures: ['timestamp-query'] } });
  const format = navigator.gpu.getPreferredCanvasFormat();
  const ctx = root.configureContext({ canvas, format, alphaMode: 'opaque' });
  const uni = root.createUniform(Uniforms);
  const group = root.createBindGroup(layout, { u: uni });
  let gpuMs: number | undefined;
  let pipeline = root.createRenderPipeline({ vertex: vert, fragment: frag, targets: { format } }).with(group);
  if (root.enabledFeatures.has('timestamp-query')) {
    pipeline = pipeline.withPerformanceCallback((start, end) => { gpuMs = Number(end - start) / 1e6; });
  }
  let alive = true;
  root.device.lost.then((info) => { if (alive) console.warn('[hero-shader] WebGPU device lost', info.message); alive = false; });

  const CONCEPTS = ['caustics', 'inkwash', 'growth'] as const;
  const plantVecs = (a: Float32Array) => Array.from({ length: PLANT_SLOTS }, (_, i) => d.vec4f(a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]));
  const renderer: Renderer = {
    resize() { /* the canvas context follows canvas.width/height automatically */ },
    draw(s: FrameState) {
      if (!alive) return;
      const pal = PALETTE[s.theme];
      const c = pal[CONCEPTS[s.mode]];
      const m = s.mask, k = s.maskK;
      uni.write({
        res: d.vec2f(s.w, s.h), pointer: d.vec2f(s.px, s.py), vel: d.vec2f(s.vx, s.vy),
        time: s.time, progress: s.progress, presence: s.presence, mode: s.mode,
        canvas: d.vec3f(...pal.canvas),
        c0: d.vec3f(...c[0]), c1: d.vec3f(...c[1]), c2: d.vec3f(...c[2]), c3: d.vec3f(...c[3]), c4: d.vec3f(...c[4]),
        mask: [d.vec4f(m[0], m[1], m[2], m[3]), d.vec4f(m[4], m[5], m[6], m[7]), d.vec4f(m[8], m[9], m[10], m[11]), d.vec4f(m[12], m[13], m[14], m[15])],
        maskK: d.vec4f(k[0], k[1], k[2], k[3]),
        plantN: s.plantN, plants: plantVecs(s.plants),
      });
      pipeline.withColorAttachment({ view: ctx }).draw(3);
    },
    gpuMs: () => gpuMs,
    destroy() { alive = false; root.destroy(); },
  };
  return createRuntime(canvas, opts, 'webgpu', renderer);
}
