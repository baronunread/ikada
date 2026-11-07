// @ts-nocheck: TGSL vector operators (`a + b` on vec3f) are valid for the typegpu transpiler but not for tsc. The
// shader is checked by the transpiler at build time (unplugin-typegpu) and by rendering (README.md, "Verify").
// TGSL helpers the dusk shader uses, from mockups-20261104/shader-concepts/src/gpu-common.ts (without the two marks
// as SDFs): colour conversion on the CPU, hashing and value noise, the soft capsule contrast mask, sRGB encode with
// dither, and the fullscreen triangle.
import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';

// ---------------------------------------------------------------------------------------------------- colour (CPU)
/** OKLCH → linear sRGB (clamped). */
export function oklch(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const c = (x: number) => Math.min(1, Math.max(0, x));
  return [c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), c(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
export const v3 = (c: [number, number, number]) => d.vec3f(c[0], c[1], c[2]);
/** Page canvas colours (shared.css): slate dark, neutral light. */
export const CANVAS = { dark: oklch(0.18, 0.014, 255), light: oklch(0.965, 0, 0) };
export const FG = { dark: oklch(0.95, 0.01, 255), light: oklch(0.22, 0, 0) };

// ---------------------------------------------------------------------------------------------------- noise
export const hash21 = (p: d.v2f): number => {
  'use gpu';
  let p3 = std.fract(d.vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + std.dot(p3, d.vec3f(p3.y, p3.z, p3.x) + 33.33);
  return std.fract((p3.x + p3.y) * p3.z);
};
export const hash11 = (x: number): number => {
  'use gpu';
  return hash21(d.vec2f(x, x * 1.618 + 7.1));
};
const quintic = (x: number): number => {
  'use gpu';
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const noise = (p: d.v2f): number => {
  'use gpu';
  const i = std.floor(p);
  const f = std.fract(p);
  const ux = quintic(f.x);
  const uy = quintic(f.y);
  const a = hash21(i);
  const b = hash21(i + d.vec2f(1, 0));
  const c = hash21(i + d.vec2f(0, 1));
  const e = hash21(i + d.vec2f(1, 1));
  return std.mix(std.mix(a, b, ux), std.mix(c, e, ux), uy);
};
export const fbm3 = (p0: d.v2f): number => {
  'use gpu';
  let p = d.vec2f(p0);
  let v = d.f32(0);
  let amp = d.f32(0.5);
  for (let i = 0; i < 3; i++) {
    v += amp * noise(p);
    p = d.vec2f(p.x * 1.6 - p.y * 1.2 + 1.7, p.x * 1.2 + p.y * 1.6 + 9.2);
    amp *= 0.5;
  }
  return v;
};

// ---------------------------------------------------------------------------------------------------- mask + output
export const MASK_FEATHER = 0.2;
/** Soft capsule protection (specimen-shader rev 3): k inside the zone, gaussian fade outside. p: aspect space, y up. */
export const rectMask = (p: d.v2f, r: d.v4f, k: number, aspect: number): number => {
  'use gpu';
  const c = d.vec2f(((r.x + r.z) * 0.5 - 0.5) * aspect, 0.5 - (r.y + r.w) * 0.5);
  const hs = d.vec2f((r.z - r.x) * 0.5 * aspect, (r.w - r.y) * 0.5);
  const rad = std.min(0.5, std.min(hs.x, hs.y));
  const q = std.abs(p - c) - (hs - rad);
  const dd = std.max(std.length(std.max(q, d.vec2f(0))) + std.min(std.max(q.x, q.y), 0) - rad, 0);
  const F = MASK_FEATHER * std.min(1, aspect * 0.85);
  return k * std.exp((-dd * dd) / (F * F * 0.33));
};
export const maskAll = (p: d.v2f, m0: d.v4f, m1: d.v4f, m2: d.v4f, m3: d.v4f, k: d.v4f, aspect: number): number => {
  'use gpu';
  return 1 - (1 - rectMask(p, m0, k.x, aspect)) * (1 - rectMask(p, m1, k.y, aspect)) * (1 - rectMask(p, m2, k.z, aspect)) * (1 - rectMask(p, m3, k.w, aspect));
};
export const encode = (c: d.v3f): d.v3f => {
  'use gpu';
  const cc = std.max(c, d.vec3f(0));
  const hi = std.pow(cc, d.vec3f(1 / 2.4)) * 1.055 - 0.055;
  return std.select(hi, cc * 12.92, std.le(cc, d.vec3f(0.0031308)));
};
/** Interleaved-gradient dither, ±0.5/255, kills banding in the soft gradients. */
export const dither = (fc: d.v2f): number => {
  'use gpu';
  return (std.fract(52.9829189 * std.fract(0.06711056 * fc.x + 0.00583715 * fc.y)) - 0.5) / 255;
};

export const fullscreenVert = tgpu.vertexFn({ in: { idx: d.builtin.vertexIndex }, out: { pos: d.builtin.position, uv: d.vec2f } })((input) => {
  'use gpu';
  const x = d.f32((input.idx << 1) & 2);
  const y = d.f32(input.idx & 2);
  return { pos: d.vec4f(x * 2 - 1, 1 - y * 2, 0, 1), uv: d.vec2f(x, y) };
});

