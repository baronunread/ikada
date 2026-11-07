/// <reference types="@webgpu/types" />
// Raft at dusk: the simulation, the camera presets, the adaptive-resolution guard and the mount.
// From mockups-20261104/shader-concepts/dusk-v2/src/hero.ts, plus the camera presets and setCamera (README.md).
//
// Determinism: the picture is a pure function of the state (time, springs, swells, theme blend, camera weights), the
// canvas size and the mask. A restored state renders its first frame with dt = 0, so it is pixel-identical to the
// last frame the previous page drew (same canvas size, same render scale).
import tgpu, { type TgpuRoot } from 'typegpu';
import * as d from 'typegpu/data';
import { CANVAS, oklch, v3 } from './gpu';
import { DI, DI2, DU, L, NSW, NW, SW, duskFrag, fullscreenVert } from './shader';

export type Theme = 'light' | 'dark';
export type Backend = 'webgpu' | 'static';
export type Camera = 'wide' | 'raft' | 'sky';
type Spring = [number, number]; // [x, v]

export interface DuskState {
  v: 3;
  time: number;
  /** 0 = dark (blue hour), 1 = light (golden hour); eased between on theme change */
  theme: number;
  /** springs: camera truck/tilt, raft pose, sprout sway, pointer, theme, and one weight per camera preset (cam:wide…) */
  springs: Record<string, Spring>;
  /** tap swells: [x, z, age s, amplitude] */
  swells: [number, number, number, number][];
  /** pointer presence 0..1 */
  presence: number;
  /** adaptive render scale (multiplies the DPR cap) */
  scale: number;
  /** the camera preset the scene is gliding to (or resting at) */
  camera: Camera;
  /** the contrast mask as drawn (canvas uv), so a restored first frame matches the previous page's last one */
  mask: Rect[];
}

export interface Rect { x0: number; y0: number; x1: number; y1: number; k: number }
export interface Stats { backend: Backend; fps: number; cpuMs: number; /** median raw single-pass GPU time */ gpuMs?: number; budget?: number; dpr: number; scale: number; w: number; h: number }
export interface MountOptions {
  camera: Camera;
  theme: Theme;
  /** from getState() on the previous page: the first frame renders it exactly (dt = 0), then glides to `camera` */
  state?: DuskState;
  /** one still frame (raft pre-settled), no loop, presses ignored, camera changes cut */
  reduced?: boolean;
  /** pointer listeners (passive); default canvas.parentElement */
  host?: HTMLElement;
  /** default 1 desktop, 1.25 coarse pointer */
  maxDpr?: number;
  /** default 60 desktop, 30 coarse pointer */
  maxFps?: number;
  /** guard threshold on the raw GPU pass time (ms), default 8 (README.md, "Guard") */
  budgetMs?: number;
  /** contrast zones for the FIRST frame (needed for a pixel-exact restore); later: setMask */
  mask?: Rect[];
  /** presses on these never send a swell (default: links, buttons, form controls) */
  ignore?: string;
  /** adaptive resolution guard (default on) */
  adaptive?: boolean;
  onStats?: (s: Stats) => void;
  /** once, right after the first frame is submitted: reveal the canvas here */
  onFirstFrame?: () => void;
}
export interface Handle {
  backend: Backend;
  /** glide to a preset (~600 ms, Afloat's critically damped spring); cuts when reduced or `animate: false` */
  setCamera(name: Camera, opts?: { animate?: boolean }): void;
  /** eased: the sun rises from blue hour to golden hour (snaps when reduced) */
  setTheme(t: Theme): void;
  setReduced(b: boolean): void;
  /** canvas uv, up to 4; `animate` eases from the current mask (~420 ms) */
  setMask(rects: Rect[], opts?: { animate?: boolean }): void;
  /** canvas uv: a swell from the sea under it (from the horizon on the sky) */
  tap(u: number, v: number): void;
  /** JSON-safe */
  getState(): DuskState;
  /** re-renders the current state and returns a data URL (the hand-off poster) */
  snapshot(type?: string, quality?: number): string | null;
  pause(): void;
  resume(): void;
  destroy(): void;
  /** debug: raw single-pass timestamps (ms), newest last */
  gpuHist: number[];
  /** debug: change the guard threshold at runtime */
  setBudget(ms: number): void;
  running(): boolean;
}

// ------------------------------------------------------------------------------------------------ waves (CPU mirror)
function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const WAVES = (() => {
  const r = rng(9157);
  const wv: number[][] = [], wq: number[][] = [];
  const wind = 0.42; // radians off +z (toward the camera, drifting right)
  for (let i = 0; i < NW; i++) {
    const a = wind + (r() - 0.5) * (0.9 + i * 0.3);
    const k = 1.15 * Math.pow(1.31, i);
    const amp = 0.036 * Math.pow(0.7, i);
    const omega = Math.sqrt(9.81 * k) * 0.6;
    const sharp = 1.1 + 0.07 * i;
    wv.push([Math.sin(a), Math.cos(a), k, amp]);
    wq.push([omega, r() * 6.283, sharp, 0]);
  }
  // mean of exp(s (sin x − 1)) over a period, per wave, so the sea's mean level is 0
  let mean = 0;
  for (let i = 0; i < NW; i++) { let m = 0; for (let j = 0; j < 256; j++) m += Math.exp(wq[i][2] * (Math.sin((j / 256) * 2 * Math.PI) - 1)); mean += (wv[i][3] * m) / 256; }
  return { wv, wq, mean };
})();

/** The raft drifts slowly toward the island, seen as the sea sliding past. A constant (not solved from the framing),
 *  so a camera glide or a resize never shifts the waves' phase. */
const DRIFT: [number, number] = [Math.sin(0.23) * 0.075, -Math.cos(0.23) * 0.075];

function waveH(x: number, z: number, t: number, swells: number[][]) {
  const px = x + DRIFT[0] * t, pz = z + DRIFT[1] * t;
  let h = 0;
  for (let i = 0; i < NW; i++) {
    const w = WAVES.wv[i], q = WAVES.wq[i];
    const ph = (w[0] * px + w[1] * pz) * w[2] - q[0] * t + q[1];
    h += w[3] * Math.exp(q[2] * (Math.sin(ph) - 1));
  }
  for (const s of swells) {
    if (s[3] <= 0) continue;
    const r = Math.hypot(x - s[0], z - s[1]) + 1e-4, sp = 1 / (1 + r * 0.35);
    const f = r - SW.c * s[2];
    h += s[3] * Math.exp(-s[2] * SW.decay) * sp * Math.sin(f * SW.k) * Math.exp(-(f * f) / SW.w);
  }
  return h - WAVES.mean;
}

// ------------------------------------------------------------------------------------------------ small math
type V3 = [number, number, number];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
/** rotate v around unit axis k by angle a (Rodrigues) */
const rot = (v: V3, k: V3, a: number): V3 => { const c = Math.cos(a), s = Math.sin(a); return add(add(scl(v, c), cross(k, v), s), k, dot(k, v) * (1 - c)); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Spring step. zeta = 1 critically damped, response r seconds (period of the undamped spring, as Afloat's tokens). */
function spring(s: Spring, target: number, r: number, dt: number, zeta = 1) {
  const w = (2 * Math.PI) / r;
  let left = dt;
  while (left > 1e-6) { const h = Math.min(left, 0.008); s[1] += (w * w * (target - s[0]) - 2 * zeta * w * s[1]) * h; s[0] += s[1] * h; left -= h; }
}

// ------------------------------------------------------------------------------------------------ camera presets
/** A preset is the framing it solves for, as a pair [portrait (aspect ≤ 0.5), landscape (aspect ≥ 1.5)]:
 *  f focal length (in canvas heights), hv horizon height (canvas v, 0 top), rv raft centre (v), pw the raft's width
 *  (in canvas heights, capped by pwW × aspect so it fits a portrait canvas), uS the sun and uI the island (canvas u). */
interface Framing { f: number; hv: number; rv: number; pw: number; pwW: number; uS: number; uI: number; uI2: number }
type Preset = [Framing, Framing];
export const CAMERAS: Record<Camera, Preset> = {
  // sproutboat.com: the raft small and low, drifting toward the island; the headline on open sky
  wide: [
    { f: 1.45, hv: 0.6, rv: 0.8, pw: 0.15, pwW: 0.34, uS: 0.2, uI: 0.74, uI2: 0.16 },
    { f: 1.8, hv: 0.62, rv: 0.82, pw: 0.17, pwW: 0.34, uS: 0.235, uI: 0.74, uI2: 0.13 },
  ],
  // ikada: closer on the raft and the sprout, low in the frame; the headline on the sky above
  raft: [
    { f: 1.45, hv: 0.6, rv: 0.855, pw: 0.3, pwW: 0.66, uS: 0.18, uI: 0.8, uI2: 0.17 },
    { f: 1.8, hv: 0.62, rv: 0.86, pw: 0.43, pwW: 0.66, uS: 0.2, uI: 0.8, uI2: 0.13 },
  ],
  // docs: tilted up into the calm sky; a strip of sea at the bottom, the raft below the frame
  sky: [
    { f: 1.45, hv: 0.9, rv: 1.3, pw: 0.15, pwW: 0.34, uS: 0.2, uI: 0.74, uI2: 0.16 },
    { f: 1.8, hv: 0.92, rv: 1.3, pw: 0.17, pwW: 0.34, uS: 0.235, uI: 0.74, uI2: 0.13 },
  ],
};
const CAMS = Object.keys(CAMERAS) as Camera[];
/** The glide: critically damped (Afloat: only presses bob), response 0.4 s, so it settles in ~600 ms. */
const CAM_RESPONSE = 0.4;

// ------------------------------------------------------------------------------------------------ palettes
// OKLCH, converted to linear sRGB. Slate + neutrals, warm only near the sun, green for the sprout.
const P = (o: Record<string, [number, number, number]>) => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, oklch(c[0], c[1], c[2])])) as unknown as Record<string, V3>;
const DARK = P({
  zen: [0.18, 0.03, 258], mid: [0.27, 0.035, 250], hor: [0.43, 0.025, 236], warm: [0.6, 0.085, 46], glow: [0.7, 0.12, 50], sunC: [0.88, 0.1, 62],
  deep: [0.17, 0.026, 236], scat: [0.4, 0.06, 205], islC: [0.21, 0.02, 245], bark: [0.5, 0.024, 64], endw: [0.74, 0.045, 74], rope: [0.8, 0.03, 84],
  leaf: [0.44, 0.12, 148], leafT: [0.76, 0.18, 143], moss: [0.32, 0.045, 135], cloudLit: [0.62, 0.06, 40], cloudShd: [0.34, 0.035, 262],
});
const LIGHT = P({
  zen: [0.7, 0.08, 240], mid: [0.84, 0.05, 236], hor: [0.925, 0.022, 90], warm: [0.92, 0.06, 78], glow: [0.95, 0.085, 82], sunC: [0.99, 0.05, 88],
  deep: [0.42, 0.06, 234], scat: [0.62, 0.08, 200], islC: [0.5, 0.035, 245], bark: [0.42, 0.024, 62], endw: [0.72, 0.045, 75], rope: [0.8, 0.03, 85],
  leaf: [0.48, 0.13, 148], leafT: [0.8, 0.18, 142], moss: [0.4, 0.05, 135], cloudLit: [0.97, 0.03, 80], cloudShd: [0.84, 0.025, 240],
});
const SCAL = {
  dark: { sunEl: 0.028, sunI: 1.5, stars: 1, fog: 0.0105, cloud: 0.8, glare: 1.0, sunR: 0.0085 },
  light: { sunEl: 0.06, sunI: 2.4, stars: 0, fog: 0.0125, cloud: 0.7, glare: 0.6, sunR: 0.008 },
};

// ------------------------------------------------------------------------------------------------ the simulation
/** The raft turns very slowly; a pure function of time so any state renders the same picture. */
const raftYaw = (t: number) => 0.55 + 0.05 * Math.sin(t * 0.06);
const SPRINGS = ['truck', 'tilt', 'bob', 'roll', 'pitch', 'sway', 'theme', 'px', 'py', 'pvx'] as const;
const camKey = (c: Camera) => `cam:${c}`;

/** A fresh scene starts at t = 26.4 s (stars out) and is pre-settled in mount, so the static poster, rendered from
 *  the same state, is also the first live frame. */
export function freshState(theme: Theme, camera: Camera): DuskState {
  const springs: Record<string, Spring> = {};
  for (const k of SPRINGS) springs[k] = [0, 0];
  springs.theme = [theme === 'light' ? 1 : 0, 0];
  springs.px = [0.5, 0]; springs.py = [0.5, 0];
  for (const c of CAMS) springs[camKey(c)] = [c === camera ? 1 : 0, 0];
  return { v: 3, time: 26.4, theme: theme === 'light' ? 1 : 0, springs, swells: [], presence: 0, scale: 1, camera, mask: [] };
}

/** Accepts a v2 state (dusk-v2 mockup) or v3; anything else starts fresh. */
function upgrade(s: DuskState | undefined): DuskState | null {
  if (!s || typeof s !== 'object' || !s.springs || typeof s.time !== 'number') return null;
  const out = structuredClone(s) as DuskState;
  out.v = 3;
  out.camera = CAMS.includes(out.camera) ? out.camera : 'wide';
  for (const k of SPRINGS) out.springs[k] ??= [k === 'px' || k === 'py' ? 0.5 : 0, 0];
  if (!CAMS.some((c) => out.springs[camKey(c)])) for (const c of CAMS) out.springs[camKey(c)] = [c === out.camera ? 1 : 0, 0];
  for (const c of CAMS) out.springs[camKey(c)] ??= [0, 0];
  if (!Array.isArray(out.mask)) out.mask = [];
  return out;
}

class Sim {
  s: DuskState;
  cam = { pos: [0, 1, 9] as V3, f: [0, 0, -1] as V3, r: [1, 0, 0] as V3, u: [0, 1, 0] as V3, focal: 2.2 };
  raft = { pos: [0, 0, 0] as V3, X: [1, 0, 0] as V3, Y: [0, 1, 0] as V3, Z: [0, 0, 1] as V3, yaw: 0 };
  lay = { f: 2.2, D: 9, h: 1, pitch: 0, sunAz: -0.3, islX: 20, islS: 5, isl2X: 40, isl2S: 4 };
  aspect = 1.6;
  constructor(s: DuskState) { this.s = s; this.layout(); }

  /** The framing, blended over the presets by their weights, then solved for the aspect ratio. */
  framing(): Framing {
    const k = clamp((this.aspect - 0.5) / 1.0, 0, 1);
    const out = { f: 0, hv: 0, rv: 0, pw: 0, pwW: 0, uS: 0, uI: 0, uI2: 0 };
    let sum = 0;
    for (const c of CAMS) sum += Math.max(0, this.s.springs[camKey(c)][0]);
    for (const c of CAMS) {
      const w = sum > 1e-6 ? Math.max(0, this.s.springs[camKey(c)][0]) / sum : c === this.s.camera ? 1 : 0;
      if (!w) continue;
      const [a, b] = CAMERAS[c];
      for (const key of Object.keys(out) as (keyof Framing)[]) {
        let v = mix(a[key], b[key], k);
        if (key === 'pw') v = Math.min(v, mix(a.pwW, b.pwW, k) * this.aspect);
        out[key] += v * w;
      }
    }
    return out;
  }

  /** Composition from the framing: horizon, raft, sun and island where the preset puts them on the canvas. */
  layout(aspect = this.aspect) {
    this.aspect = aspect;
    const F = this.framing();
    const f = F.f;
    const D = (1.22 * f) / F.pw;
    const pitch = Math.atan((F.hv - 0.5) / f);
    const dep = Math.atan((F.rv - 0.5) / f) - pitch;
    const h = 0.1 + D * Math.tan(dep);
    const sunAz = Math.atan(((F.uS - 0.5) * aspect) / f);
    const islAz = Math.atan(((F.uI - 0.5) * aspect) / f);
    const wI = clamp(0.2 * aspect, 0.16, 0.3);
    const islS = ((wI / 2) / f) * (DI + D);
    const isl2Az = Math.atan(((F.uI + F.uI2 - 0.5) * aspect) / f);
    this.lay = { f, D, h, pitch, sunAz, islX: Math.tan(islAz) * (DI + D), islS, isl2X: Math.tan(isl2Az) * (DI2 + D), isl2S: islS * 0.62 * ((DI2 + D) / (DI + D)) };
  }

  /** Is the camera still gliding? */
  gliding() {
    return CAMS.some((c) => { const sp = this.s.springs[camKey(c)]; return Math.abs(sp[0] - (c === this.s.camera ? 1 : 0)) > 1e-4 || Math.abs(sp[1]) > 1e-3; });
  }
  cutCamera() { for (const c of CAMS) this.s.springs[camKey(c)] = [c === this.s.camera ? 1 : 0, 0]; this.layout(); }

  step(dt: number, ptr: { x: number; y: number; presence: number; vx: number }, themeTarget: number) {
    const s = this.s, S = s.springs;
    s.time += dt;
    s.presence = ptr.presence;
    spring(S.px, ptr.x, 0.45, dt); spring(S.py, ptr.y, 0.45, dt);
    spring(S.pvx, clamp(ptr.vx, -3, 3), 0.25, dt);
    spring(S.theme, themeTarget, 0.75, dt);
    spring(S.truck, (S.px[0] - 0.5) * 0.7 * s.presence, 1.1, dt);
    spring(S.tilt, (S.py[0] - 0.5) * 0.014 * s.presence, 1.1, dt);
    if (dt > 0 && this.gliding()) {
      for (const c of CAMS) spring(S[camKey(c)], c === s.camera ? 1 : 0, CAM_RESPONSE, dt);
      if (!this.gliding()) this.cutCamera();
      this.layout();
    }
    for (const w of s.swells) w[2] += dt;
    s.swells = s.swells.filter((w) => w[2] < 10);
    // raft pose from the same waves: bob from the mean height under the hull, pitch and roll from the slopes
    const yaw = raftYaw(s.time);
    const X0: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)], Z0: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
    const at = (lx: number, lz: number) => { const p = add(scl(X0, lx), Z0, lz); return waveH(p[0], p[2], s.time, s.swells); };
    const hx1 = (at(0.5, -0.17) + at(0.5, 0.17)) / 2, hx0 = (at(-0.5, -0.17) + at(-0.5, 0.17)) / 2;
    const hz1 = (at(-0.3, 0.2) + at(0.3, 0.2)) / 2, hz0 = (at(-0.3, -0.2) + at(0.3, -0.2)) / 2;
    const hc = (hx1 + hx0 + hz1 + hz0 + at(0, 0) * 2) / 6;
    if (dt > 0) {
      spring(S.bob, hc, 0.62, dt, 0.72);
      spring(S.pitch, Math.atan((hx1 - hx0) / 1.0) * 0.85, 0.8, dt, 0.6);
      spring(S.roll, Math.atan((hz1 - hz0) / 0.4) * 0.55, 0.8, dt, 0.6);
      const breeze = Math.sin(s.time * 0.73) * 0.22 + Math.sin(s.time * 1.91 + 1.3) * 0.07;
      spring(S.sway, breeze + S.pvx[0] * 0.55 * s.presence - S.roll[1] * 1.8 - S.pitch[1] * 1.2, 0.55, dt, 0.32);
    }
  }

  /** Everything the GPU needs, from the state. */
  pack(w: number, h: number, mask: Float32Array, maskK: Float32Array) {
    const s = this.s, S = s.springs, L0 = this.lay;
    const tb = clamp(S.theme[0], 0, 1);
    const te = tb * tb * (3 - 2 * tb);
    // camera: truck with the cursor, re-aim most of the way (parallax: the island and sky move more than the raft)
    const truck = S.truck[0];
    const yaw = (-truck / L0.D) * 0.72;
    const pitch = L0.pitch + S.tilt[0];
    const pos: V3 = [truck, L0.h + S.tilt[0] * 2, L0.D];
    const f = norm([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]);
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    this.cam = { pos, f, r, u, focal: L0.f };
    // raft basis: yaw, then pitch about the local z, then roll about the local x
    const ry = (this.raft.yaw = raftYaw(s.time));
    let X: V3 = [Math.cos(ry), 0, -Math.sin(ry)], Y: V3 = [0, 1, 0], Z: V3 = [Math.sin(ry), 0, Math.cos(ry)];
    X = rot(X, Z, S.pitch[0]); Y = rot(Y, Z, S.pitch[0]);
    Y = rot(Y, X, S.roll[0]); Z = rot(Z, X, S.roll[0]);
    this.raft.X = X; this.raft.Y = Y; this.raft.Z = Z;
    this.raft.pos = [0, S.bob[0] + 0.035, 0];
    // sprout (raft-local): stem top bends with the sway; leaves face the camera, tilt up to the sky
    const sw = S.sway[0];
    const X0: V3 = [Math.cos(ry), 0, -Math.sin(ry)], Z0: V3 = [Math.sin(ry), 0, Math.cos(ry)];
    const toL = (v: V3): V3 => [dot(v, X0), v[1], dot(v, Z0)];
    const topW: V3 = [0.012 + sw * 0.045, 0.43, 0.012];
    const leaf = (side: number, deg: number, lean: number, twist: number) => {
      const th = ((deg + sw * 9 * side) * Math.PI) / 180;
      const A = norm([side * Math.sin(th), Math.cos(th), lean]);
      let B = norm([Math.cos(th), -side * Math.sin(th), 0]);
      B = norm(add(B, A, -dot(B, A)));
      B = rot(B, A, twist * side);
      return [toL(A), toL(B)] as const;
    };
    const [lA, lB] = leaf(-1, 50, 0.22, 0.42);
    const [rA, rB] = leaf(1, 45, 0.12, 0.36);
    const top = toL(topW);
    // theme: palettes and the sun blend (switching to light is the sun rising)
    const col = (k: string) => v3(mix3(DARK[k], LIGHT[k], te));
    const sc = (k: keyof typeof SCAL.dark) => mix(SCAL.dark[k], SCAL.light[k], te);
    const el = sc('sunEl'), az = L0.sunAz;
    const sun = norm([Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]);
    const canvas = mix3(CANVAS.dark, CANVAS.light, te);
    const m = mask, k = maskK;
    const sw4 = Array.from({ length: NSW }, (_, i) => (s.swells[i] ? d.vec4f(...s.swells[i]) : d.vec4f(0)));
    const bobV = Math.abs(S.bob[1]);
    return {
      res: d.vec2f(w, h), time: s.time, aspect: w / h,
      camPos: d.vec3f(...pos), focal: L0.f, camF: d.vec3f(...f), pixA: 1 / (h * L0.f), camR: d.vec3f(...r), light: te, camU: d.vec3f(...u), stars: sc('stars'),
      sun: d.vec3f(...sun), sunI: sc('sunI'),
      raftPos: d.vec3f(...this.raft.pos), sway: sw, raftX: d.vec3f(...X), wake: clamp(bobV * 0.9, 0, 0.12), raftY: d.vec3f(...Y), hMean: WAVES.mean, raftZ: d.vec3f(...Z), fogK: sc('fog'),
      sTop: d.vec3f(...top), cloud: sc('cloud'), lA: d.vec3f(...lA), sunR: sc('sunR'), lB: d.vec3f(...lB), starFade: clamp((s.time - 0.5) / 9, 0, 1) * 1.2, rA: d.vec3f(...rA), rip: 0, rB: d.vec3f(...rB), glare: sc('glare'),
      drift: d.vec2f(...DRIFT), isl: d.vec2f(L0.islX, L0.islS), isl2: d.vec2f(L0.isl2X, L0.isl2S), pad0: d.vec2f(0),
      zen: col('zen'), mid: col('mid'), hor: col('hor'), warm: col('warm'), glow: col('glow'), sunC: col('sunC'),
      deep: col('deep'), scat: col('scat'), islC: col('islC'), bark: col('bark'), endw: col('endw'), rope: col('rope'),
      leaf: col('leaf'), leafT: col('leafT'), moss: col('moss'), canvas: v3(canvas), cloudLit: col('cloudLit'), cloudShd: col('cloudShd'),
      mask0: d.vec4f(m[0], m[1], m[2], m[3]), mask1: d.vec4f(m[4], m[5], m[6], m[7]), mask2: d.vec4f(m[8], m[9], m[10], m[11]), mask3: d.vec4f(m[12], m[13], m[14], m[15]),
      maskK: d.vec4f(k[0], k[1], k[2], k[3]),
      wv: WAVES.wv.map((a) => d.vec4f(a[0], a[1], a[2], a[3])), wq: WAVES.wq.map((a) => d.vec4f(a[0], a[1], a[2], a[3])), sw: sw4,
    };
  }

  /** A press at canvas uv sends a swell from the sea under it (or from the horizon under a press on the sky). */
  tap(uu: number, vv: number) {
    const c = this.cam, px = (uu - 0.5) * this.aspect, py = 0.5 - vv;
    const rd = norm(add(add(scl(c.f, c.focal), c.r, px), c.u, py));
    let x: number, z: number;
    if (rd[1] < -0.01) { const t = Math.min(-c.pos[1] / rd[1], 14); x = c.pos[0] + rd[0] * t; z = c.pos[2] + rd[2] * t; }
    else { const hd = norm([rd[0], 0, rd[2]]); x = c.pos[0] + hd[0] * 12; z = c.pos[2] + hd[2] * 12; }
    this.s.swells.push([x, z, 0, 0.042]);
    if (this.s.swells.length > NSW) this.s.swells.shift();
  }
}

// ------------------------------------------------------------------------------------------------ mount
const BENCH = typeof location !== 'undefined' ? Math.max(1, Number(new URLSearchParams(location.search).get('bench')) || 1) : 1;

export async function mount(canvas: HTMLCanvasElement, opts: MountOptions): Promise<Handle> {
  let theme: Theme = opts.theme;
  let reduced = !!opts.reduced;
  const restoredState = upgrade(opts.state);
  const restored = !!restoredState;
  const state = restoredState ?? freshState(theme, opts.camera);
  const staticHandle = (): Handle => {
    let s = state;
    return {
      backend: 'static', setCamera(c) { s = { ...s, camera: c }; }, setTheme() {}, setReduced() {}, setMask() {}, tap() {},
      getState: () => structuredClone(s), snapshot: () => null, pause() {}, resume() {}, destroy() {}, gpuHist: [], setBudget() {}, running: () => false,
    };
  };
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  let root: TgpuRoot;
  try {
    const adapter = gpu ? await gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
    if (!adapter) return staticHandle();
    const feats: GPUFeatureName[] = adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
    const device = await adapter.requestDevice({ requiredFeatures: feats });
    root = tgpu.initFromDevice({ device });
  } catch { return staticHandle(); }
  const device = root.device;
  const format = navigator.gpu.getPreferredCanvasFormat();
  const ctx = canvas.getContext('webgpu');
  if (!ctx) { root.destroy(); return staticHandle(); }

  const uni = root.createBuffer(DU).$usage('uniform');
  const bg = root.createBindGroup(L, { u: uni });
  const makePipe = () => root.createRenderPipeline({ vertex: fullscreenVert, fragment: duskFrag, targets: { format } });
  let pipe: ReturnType<typeof makePipe>;
  try { pipe = makePipe(); } catch (e) { console.error(e); root.destroy(); return staticHandle(); }

  const host = opts.host ?? canvas.parentElement!;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth <= 820;
  const maxFps = opts.maxFps ?? (coarse ? 30 : 60);
  const maxDpr = opts.maxDpr ?? (coarse ? 1.25 : 1);
  const MIN_SCALE = 0.5;
  const sim = new Sim(state);
  // a theme that differs from the stored one snaps (the hand-off only carries a picture for the same theme)
  if (Math.abs(sim.s.springs.theme[0] - (theme === 'light' ? 1 : 0)) > 0.5) sim.s.springs.theme = [theme === 'light' ? 1 : 0, 0];
  if (reduced) { sim.s.camera = opts.camera; sim.cutCamera(); }
  if (!restored) settle();
  /** A fresh scene lets the raft find its pose on the water before the first frame (deterministic, ~2 ms). */
  function settle() { const r = canvas.getBoundingClientRect(); sim.layout(r.width / Math.max(1, r.height)); for (let i = 0; i < 240; i++) sim.step(1 / 60, { x: 0.5, y: 0.5, presence: 0, vx: 0 }, theme === 'light' ? 1 : 0); }
  let scale = clamp(sim.s.scale || 1, MIN_SCALE, 1);
  // contrast mask: what is drawn (sim.s.mask) eases toward the target over MASK_MS, so a restored first frame can
  // draw the previous page's mask and then move to this page's text
  const mask = new Float32Array(16), maskK = new Float32Array(4);
  const MASK_MS = 420;
  const norm4 = (rs: Rect[]) => Array.from({ length: 4 }, (_, i) => rs[i] ?? { x0: 0, y0: 0, x1: 0, y1: 0, k: 0 });
  let maskFrom = norm4(sim.s.mask), maskTo = norm4(opts.mask ?? sim.s.mask), maskT = restored && opts.mask && !reduced ? 0 : 1;
  const maskAt = (t: number): Rect[] => {
    const e = 1 - Math.pow(1 - clamp(t, 0, 1), 3);
    return maskTo.map((b, i) => {
      const a = maskFrom[i];
      // a zone that appears or disappears keeps its box and only fades
      const g = a.k === 0 ? b : b.k === 0 ? a : null;
      return g ? { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, k: mix(a.k, b.k, e) } : { x0: mix(a.x0, b.x0, e), y0: mix(a.y0, b.y0, e), x1: mix(a.x1, b.x1, e), y1: mix(a.y1, b.y1, e), k: mix(a.k, b.k, e) };
    });
  };
  const applyMask = () => {
    const rs = maskT >= 1 ? maskTo : maskAt(maskT);
    sim.s.mask = rs.filter((r) => r.k > 0).map((r) => ({ ...r }));
    mask.fill(0); maskK.fill(0);
    rs.forEach((r, i) => { mask.set([r.x0, r.y0, r.x1, r.y1], i * 4); maskK[i] = r.k; });
  };
  // the first frame draws the stored mask exactly (maskT = 0 → maskFrom)
  if (maskT < 1) { const keep = maskTo; maskTo = maskFrom; applyMask(); maskTo = keep; } else applyMask();

  // timing: one timestamp pair around the pass (README.md, "Frame cost": never bench by drawing N times in one pass)
  const timing = device.features.has('timestamp-query');
  const qs = timing ? device.createQuerySet({ type: 'timestamp', count: 2 }) : null;
  const qResolve = timing ? device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null;
  const qFree: GPUBuffer[] = [];
  if (timing) for (let i = 0; i < 4; i++) qFree.push(device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }));
  const gpuHist: number[] = [];
  let budget = opts.budgetMs ?? 8;
  const med = (a: number[], n: number) => { const r = a.slice(-n).sort((x, y) => x - y); return r.length ? r[r.length >> 1] : undefined; };

  // pointer (raw target; the sim springs it)
  const ptr = { x: 0.5, y: 0.5, presence: 0, vx: 0 };
  let tPresence = 0, lastMoveT = 0, lastX = 0.5, down = false;
  const pendingTaps: [number, number][] = [];

  let w = 0, h = 0, dpr = 1;
  let configured = false, visible = true, paused = false, destroyed = false, rafId = 0, last = 0, first = true;
  let frames = 0, cpuAcc = 0, statAt = 0, over = 0, under = 0, cool = 0, probing = 0, probeWait = 3;

  function configure() {
    if (configured) return;
    ctx!.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    configured = true;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, maxDpr) * scale;
    const nw = Math.max(1, Math.round(r.width * dpr)), nh = Math.max(1, Math.round(r.height * dpr));
    if (nw === w && nh === h) return false;
    w = nw; h = nh; canvas.width = w; canvas.height = h;
    sim.layout(r.width / Math.max(1, r.height));
    return true;
  }

  function render(timed: boolean) {
    if (!w || !h || destroyed) return;
    configure();
    const t0 = performance.now();
    uni.write(sim.pack(w, h, mask, maskK) as never);
    const enc = device.createCommandEncoder();
    const timedOk = timed && qs && qFree.length;
    const view = ctx!.getCurrentTexture().createView();
    // ?bench=N (measurement only): N separate full passes, timed together, so the GPU is busy and at full clock
    for (let i = 0; i < BENCH; i++) {
      const ts = timedOk && (i === 0 || i === BENCH - 1) ? { querySet: qs!, ...(i === 0 ? { beginningOfPassWriteIndex: 0 } : {}), ...(i === BENCH - 1 ? { endOfPassWriteIndex: 1 } : {}) } : undefined;
      const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }], timestampWrites: ts });
      pipe.with(bg).with(rp).draw(3);
      rp.end();
    }
    let rb: GPUBuffer | undefined;
    if (timedOk && qResolve) { rb = qFree.pop()!; enc.resolveQuerySet(qs!, 0, 2, qResolve, 0); enc.copyBufferToBuffer(qResolve, 0, rb, 0, 16); }
    device.queue.submit([enc.finish()]);
    if (rb) {
      const b = rb;
      b.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigUint64Array(b.getMappedRange());
        const ms = Number(t[1] - t[0]) / 1e6;
        b.unmap(); qFree.push(b);
        if (ms > 0 && ms < 2000) { gpuHist.push(ms / BENCH); if (gpuHist.length > 600) gpuHist.shift(); }
      }).catch(() => {});
    }
    cpuAcc += performance.now() - t0;
    frames++;
    if (first) { first = false; opts.onFirstFrame?.(); }
  }

  const shouldRun = () => !destroyed && visible && !document.hidden && !paused && !reduced;
  const schedule = () => { if (!rafId && shouldRun()) rafId = requestAnimationFrame(tick); };

  function tick(now: number) {
    rafId = 0;
    if (!shouldRun()) return;
    if (last && now - last < 1000 / maxFps - 2) { schedule(); return; }
    // dt = 0 on the first frame after mount or resume: a restored state renders exactly as it was left
    const dt = first || !last ? 0 : Math.min((now - last) / 1000, 1 / 20);
    if (!last) { statAt = 0; over = 0; under = 0; }
    last = now;
    if (now - lastMoveT > 2500 && !down) tPresence = 0;
    const kp = 1 - Math.exp(-dt / (tPresence > ptr.presence ? 0.15 : 0.6));
    ptr.presence += (tPresence - ptr.presence) * kp;
    ptr.vx = dt > 0 ? (ptr.x - lastX) / dt : 0; lastX = ptr.x;
    sim.step(dt, ptr, theme === 'light' ? 1 : 0);
    if (maskT < 1 && dt > 0) { maskT = Math.min(1, maskT + (dt * 1000) / MASK_MS); applyMask(); }
    for (const [u, v] of pendingTaps.splice(0)) sim.tap(u, v);
    render(true);
    guard(now);
    schedule();
  }

  /** Adaptive resolution (README.md, "Guard"). Down: raw pass time over the threshold, or dropped frames, for 2 s, by
   *  a step proportional to the overrun. Up: a probe ×1.25 after probeWait calm seconds; over again → back down and
   *  probeWait doubles (max 64 s), fine → probeWait resets to 3 s. So it climbs back once the load drops. */
  function guard(now: number) {
    if (now - statAt < 1000) return;
    if (!statAt) { statAt = now; frames = 0; cpuAcc = 0; return; }
    const fps = Math.round((frames * 1000) / (now - statAt));
    const m = med(gpuHist, Math.max(1, frames));
    const cpu = cpuAcc / Math.max(1, frames);
    statAt = now; frames = 0; cpuAcc = 0;
    opts.onStats?.({ backend: 'webgpu', fps, cpuMs: cpu, gpuMs: m, dpr, scale, w, h, budget });
    if (opts.adaptive === false) return;
    if (cool > 0) { cool--; return; }
    const drops = fps < maxFps * 0.9;
    const hot = drops || (m != null && m > budget);
    over = hot ? over + 1 : 0;
    under = !hot ? under + 1 : 0;
    if (over >= 2 && scale > MIN_SCALE) {
      const k = m != null && m > budget ? clamp(Math.sqrt((budget * 0.85) / m), 0.6, 0.9) : 0.85;
      scale = Math.max(MIN_SCALE, scale * k); over = 0; under = 0; cool = 1;
      if (probing > 0) probeWait = Math.min(probeWait * 2, 64);
      probing = 0;
      size(); sim.s.scale = scale;
    } else if (under >= probeWait && scale < 1) {
      scale = Math.min(1, scale * 1.25); under = 0; over = 0; cool = 1; probing = 3;
      size(); sim.s.scale = scale;
    } else if (probing > 0 && --probing === 0) probeWait = 3;
  }

  // --- pointer --------------------------------------------------------------------------------------------------
  const ignore = opts.ignore ?? 'a, button, input, select, textarea, label, summary, details, [data-no-swell]';
  const aim = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); if (!r.width) return null; return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const; };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && !down) return;
    const a = aim(e); if (!a) return;
    ptr.x = a[0]; ptr.y = a[1]; tPresence = 1; lastMoveT = performance.now();
  };
  const onDown = (e: PointerEvent) => {
    const a = aim(e); if (!a) return;
    down = true; lastMoveT = performance.now();
    if (e.pointerType !== 'touch') { ptr.x = a[0]; ptr.y = a[1]; tPresence = 1; }
    if ((e.target as Element | null)?.closest?.(ignore)) return;
    if (reduced || a[1] < 0 || a[1] > 1) return;
    pendingTaps.push([a[0], a[1]]); // respond on press
  };
  const onUp = () => { down = false; };
  const onLeave = () => { tPresence = 0; down = false; };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  host.addEventListener('pointerup', onUp, { passive: true });
  host.addEventListener('pointercancel', onUp, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });

  // --- observers ------------------------------------------------------------------------------------------------
  const ro = new ResizeObserver(() => { if (size() && (reduced || !rafId)) render(false); });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = 0; schedule(); } });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) { last = 0; schedule(); } };
  document.addEventListener('visibilitychange', onVis);

  // first frame in this task, right after configure, so the canvas never shows an empty buffer
  size();
  render(false);
  // after the restored frame: glide to this page's camera (cut under reduced motion)
  if (sim.s.camera !== opts.camera) { sim.s.camera = opts.camera; if (reduced) { sim.cutCamera(); render(false); } }
  schedule();

  const handle: Handle = {
    backend: 'webgpu',
    setCamera(name, o) {
      if (!CAMERAS[name]) return;
      sim.s.camera = name;
      if (reduced || o?.animate === false || !shouldRun()) { sim.cutCamera(); render(false); }
      else schedule();
    },
    setTheme(t) { theme = t; if (reduced || !shouldRun()) { sim.s.springs.theme = [t === 'light' ? 1 : 0, 0]; render(false); } },
    setReduced(b) {
      reduced = b;
      if (b) { cancelAnimationFrame(rafId); rafId = 0; sim.s.springs.theme = [theme === 'light' ? 1 : 0, 0]; sim.cutCamera(); maskT = 1; applyMask(); render(false); }
      else { last = 0; schedule(); }
    },
    setMask(rects, o) {
      const cur = maskT >= 1 ? maskTo : maskAt(maskT);
      maskTo = norm4(rects);
      if (o?.animate && !reduced && shouldRun()) { maskFrom = cur; maskT = 0; schedule(); }
      else { maskT = 1; applyMask(); if (!rafId) render(false); }
    },
    tap(u, v) { if (!reduced) { pendingTaps.push([u, v]); schedule(); } },
    getState() { return structuredClone({ ...sim.s, scale }); },
    snapshot(type = 'image/webp', quality = 0.92) {
      try { render(false); return canvas.toDataURL(type, quality); } catch { return null; }
    },
    pause() { paused = true; },
    resume() { paused = false; last = 0; schedule(); },
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(rafId); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerup', onUp); host.removeEventListener('pointercancel', onUp); host.removeEventListener('pointerleave', onLeave);
      root.destroy();
    },
    gpuHist,
    setBudget(ms: number) { budget = ms; },
    running: () => !!rafId,
  };
  return handle;
}
