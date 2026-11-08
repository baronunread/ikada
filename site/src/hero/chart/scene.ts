// The nautical chart: the simulation, the camera presets, the renderer (Canvas 2D, no WebGPU needed) and the mount.
// Concept G of mockups-20261104/hero-fullscreen, made a module: one deterministic world (world.ts), three cameras
// (wide, raft, corner) on one continuous zoom, markers that are real buttons, and a state that carries between pages.
//
// Determinism: the picture is a pure function of the state (the clock, the camera springs, the vessels' wake state,
// the effects in flight, the mask), the canvas size and the theme. A restored state renders its first frame with
// dt = 0, so it is pixel-identical to the last frame the previous page drew (same canvas size and pixel ratio).
import { palette, type Palette } from "./palette";
import {
  ACCT,
  anim,
  appName,
  at,
  bestRoute,
  breath,
  clamp,
  lerp,
  march,
  MARGIN,
  mkRoute,
  S,
  sstep,
  world,
  WH,
  WW,
  type Route,
  type ShipDef,
  type World,
} from "./world";

export type Theme = "light" | "dark";
export type Camera = "wide" | "raft" | "corner";
export type Backend = "canvas" | "static";
/** CSS px in the canvas's own box */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** what the page's text covers: the chart eases its contours and veils the sea there. `copy` is the union of the
 *  headline, lede and actions; `navH` the transparent header's height */
export interface Mask {
  copy: Rect | null;
  navH: number;
}

interface Run {
  aw: number;
  awUntil: number;
  pings: number[];
  ms: number;
  /** route highlight started at (clock ms); -1 = permanent (reduced motion); null = none */
  rt: number | null;
  sw: number;
}
interface Dyn extends Run {
  i: number;
  x: number;
  y: number;
  off: number;
}
interface Launch {
  i: number;
  x: number;
  y: number;
  off: number;
  t0: number;
  dur: number;
}
interface Sweep {
  t0: number;
  held: boolean;
  auto: boolean;
  id: number;
  woken: number;
  maxR: number;
}
interface LabelRec {
  /** 's3' static vessel 3, 'd12' launched vessel, 'sweep', 'raft' */
  o: string;
  text: string;
  green: boolean;
  t0: number;
  until: number;
}
export interface ChartState {
  v: 1;
  /** the clock, ms: contours drift, vessels bob, effects run on it; it only advances while the chart is running */
  t: number;
  theme: Theme;
  cam: { cx: number; cy: number; lz: number; vx: number; vy: number; vz: number; to: Camera };
  ships: Run[];
  dyn: Dyn[];
  launches: Launch[];
  sweep: Sweep | null;
  sweepSeq: number;
  pulses: number[];
  labels: LabelRec[];
  mask: { from: Mask; to: Mask; t0: number };
  /** clock at the first press (the hint fades from it) */
  used: number | null;
  demo: { next: number; n: number; sweepAt: number };
  /** the clock the contour layer was last drawn at (a restored first frame draws it at the same instant) */
  cz: number;
}

export interface Stats {
  backend: Backend;
  frames: number;
  /** mean / 95th percentile / max of the chart's own work per frame (ms) */
  cpuMs: number;
  p95Ms: number;
  maxMs: number;
  /** frames per second over the last second of running */
  fps: number;
  dpr: number;
  w: number;
  h: number;
}
export interface MountOptions {
  camera: Camera;
  theme: Theme;
  /** from getState() on the previous page: the first frame renders it exactly (dt = 0), then glides to `camera` */
  state?: ChartState;
  /** one static, informative frame: no drift, no idle demo, camera changes cut; presses still answer briefly */
  reduced?: boolean;
  /** pointer listeners (passive); default canvas.parentElement */
  host?: HTMLElement;
  /** a box over the hero (same size as the canvas, inside the page's <main>) for the marker buttons and the live region */
  markers?: HTMLElement;
  /** the raft marker links here instead of waking (sproutboat.com: "/ikada") */
  raftHref?: string;
  /** what the text covers, for the first frame (needed for a pixel-exact restore); later: setMask */
  mask?: Mask;
  /** presses on these never deploy or sweep (default: links and form controls) */
  ignore?: string;
  maxDpr?: number;
  /** words on the chart that depend on the page */
  words?: Partial<Words>;
  onStats?: (s: Stats) => void;
  /** right after the first frame is drawn: reveal the canvas here */
  onFirstFrame?: () => void;
}
export interface Words {
  legend1: string;
  legend2: string;
  hintDesktop: string;
  hintMobile: string;
  caption: string;
  raftHost: string;
  raftLabel: string;
}
export const WORDS: Words = {
  legend1: "Each marker = one app · 1.28 MiB asleep",
  legend2: "Awake · wakes in ~6 ms",
  hintDesktop: "Click the water to deploy · click a vessel to wake it · hold to sweep",
  hintMobile: "Tap the water to deploy · hold to sweep",
  caption: "One server · 1,000 apps · closed alpha · simulated values illustrative",
  raftHost: "ikada",
  raftLabel: "ikada|design system|MIT",
};
export interface Handle {
  backend: Backend;
  setCamera(name: Camera, o?: { animate?: boolean }): void;
  getState(): ChartState;
  setTheme(t: Theme): void;
  setReduced(b: boolean): void;
  setMask(m: Mask, o?: { animate?: boolean }): void;
  /** re-draws the current state and returns a data URL (no hover label) */
  snapshot(type?: string, quality?: number): string | null;
  stats(): Stats;
  pause(): void;
  resume(): void;
  running(): boolean;
  destroy(): void;
  /** the screen position of a vessel (CSS px in the canvas), for tests and tours */
  vessels(): { i: number; host: string; x: number; y: number; visible: boolean }[];
  raftPoint(): { x: number; y: number };
  /** wake a vessel as a press would (for the idle tour and tests) */
  wake(i: number): void;
  deploy(x: number, y: number): boolean;
  /** may a vessel be deployed at this canvas point */
  canDeploy(x: number, y: number): boolean;
  sweep(): void;
}

// ---------- cameras ----------
interface CamDef {
  /** the world point that sits at screen (u, v), and the zoom relative to cover-fitting the 1440 x 900 sheet */
  wx: number;
  wy: number;
  u: number;
  v: number;
  z: number;
}
function camDefs(w: World): Record<Camera, { land: CamDef; port: CamDef }> {
  return {
    wide: {
      land: { wx: WW / 2, wy: WH / 2, u: 0.5, v: 0.5, z: 1 },
      port: { wx: 1030, wy: 560, u: 0.56, v: 0.62, z: 1.28 },
    },
    raft: {
      land: { wx: w.raft.x, wy: w.raft.y, u: 0.63, v: 0.58, z: 2.9 },
      port: { wx: w.raft.x, wy: w.raft.y, u: 0.46, v: 0.7, z: 1.7 },
    },
    corner: { land: { wx: 330, wy: 700, u: 0.5, v: 0.5, z: 1.8 }, port: { wx: 330, wy: 700, u: 0.5, v: 0.5, z: 2.2 } },
  };
}
/** the framing of a camera for a canvas size: centre (world) and log zoom over cover-fit */
function resolveCam(w: World, name: Camera, W: number, H: number): { cx: number; cy: number; lz: number } {
  const def = camDefs(w)[name];
  const pw = sstep(1.12, 0.78, W / H); // 0 landscape .. 1 portrait
  const m = (k: keyof CamDef): number => lerp(def.land[k], def.port[k], pw);
  const lz = lerp(Math.log(def.land.z), Math.log(def.port.z), pw);
  const scale = Math.max(W / WW, H / WH) * Math.exp(lz);
  return { cx: m("wx") + (0.5 - m("u")) * (W / scale), cy: m("wy") + (0.5 - m("v")) * (H / scale), lz };
}

const TAU = Math.PI * 2;
const easeOut = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIO = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const NEVER = 1e15;
/** the clock a fresh chart starts at: the contours are settled and the first frame is the poster */
export const T0 = 14000;
const MONO = '"JetBrains Mono Variable","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace';
const SERIF = '"Chart Serif","Instrument Serif","Iowan Old Style",Palatino,Georgia,serif';
const ARCMIN = 30; // world units per arc minute (and per nautical mile)

const emptyRun = (): Run => ({ aw: 0, awUntil: 0, pings: [], ms: 6, rt: null, sw: -1 });
const maskOf = (m: Mask): Mask => ({ copy: m.copy ? { ...m.copy } : null, navH: m.navH });
const NOMASK: Mask = { copy: null, navH: 0 };

/** the state a fresh chart starts from, for a camera and canvas size: the clock settled, one vessel awake with its
 *  route and label (forever when reduced), so the poster and the first live frame are the same informative picture */
export function freshState(
  camera: Camera,
  W: number,
  H: number,
  theme: Theme,
  mask: Mask = NOMASK,
  reduced = false,
): ChartState {
  const w = world();
  const c = resolveCam(w, camera, W, H);
  const st: ChartState = {
    v: 1,
    t: T0,
    theme,
    cam: { cx: c.cx, cy: c.cy, lz: c.lz, vx: 0, vy: 0, vz: 0, to: camera },
    ships: w.ships.map(emptyRun),
    dyn: [],
    launches: [],
    sweep: null,
    sweepSeq: 0,
    pulses: [],
    labels: [],
    mask: { from: maskOf(mask), to: maskOf(mask), t0: -1e6 },
    used: null,
    demo: { next: T0 + 3000, n: 0, sweepAt: T0 + 20000 },
    cz: T0,
  };
  // the featured vessel: the one in view nearest the camera's focus, clear of the text
  const scale = Math.max(W / WW, H / WH) * Math.exp(c.lz);
  const focus = camera === "wide" ? [0.45, 0.72] : camera === "raft" ? [0.55, 0.78] : [0.5, 0.55];
  let best = -1;
  let bd = 1e9;
  w.ships.forEach((s, i) => {
    const x = (s.x - c.cx) * scale + W / 2;
    const y = (s.y - c.cy) * scale + H / 2;
    if (x < 70 || x > W - 70 || y < 120 || y > H - 120) return;
    const cp = mask.copy;
    if (cp && x > cp.x0 - 24 && x < cp.x1 + 24 && y > cp.y0 - 24 && y < cp.y1 + 40) return;
    const d = Math.hypot(x - focus[0]! * W, y - focus[1]! * H);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best >= 0) {
    const r = st.ships[best]!;
    r.aw = 1;
    r.ms = 6;
    r.pings = reduced ? [] : [T0 - 800];
    r.awUntil = reduced ? NEVER : T0 + 2100;
    r.rt = reduced ? -1 : T0 - 800;
    st.labels.push({
      o: "s" + best,
      text: `${w.ships[best]!.host}|running|6 ms`,
      green: true,
      t0: T0 - 800,
      until: reduced ? NEVER : T0 + 2100,
    });
  }
  return st;
}

// ---------- styles for the DOM the module owns (marker buttons, live region) ----------
const STYLE = `.sbc-layer{position:absolute;inset:0;pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.sbc-m{position:absolute;left:0;top:0;width:var(--sbc-hit,40px);height:var(--sbc-hit,40px);margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;font:inherit;pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;display:block}
.sbc-m[hidden]{display:none}
.sbc-m:focus-visible{outline:2px solid rgb(var(--sbc-accent,112,232,152));outline-offset:-2px}
.sbc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (forced-colors:active){.sbc-m:focus-visible{outline-color:Highlight}}`;
function injectStyle(): void {
  if (document.querySelector("style[data-sbc]")) return;
  const s = document.createElement("style");
  s.dataset.sbc = "";
  s.textContent = STYLE;
  document.head.appendChild(s);
}

let fontReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  return (fontReady ??= (async () => {
    try {
      const face = new FontFace(
        "Chart Serif",
        `url(${new URL("./instrument-serif-italic.woff2", import.meta.url).href})`,
        { style: "italic" },
      );
      document.fonts.add(face);
      await Promise.all([
        face.load(),
        document.fonts.load('500 10px "JetBrains Mono Variable"'),
        document.fonts.load('500 10px "JetBrains Mono"'),
      ]);
    } catch {
      /* fallbacks are in the font stacks */
    }
  })());
}

// ---------- the mount ----------
interface Ship {
  i: number;
  x: number;
  y: number;
  hd: number;
  n: string;
  host: string;
  route: Route;
  run: Run;
  dyn: boolean;
  ph: number;
  hv: number;
}
interface Marker {
  el: HTMLElement;
  ship: Ship | null;
}

export async function mount(canvas: HTMLCanvasElement, opts: MountOptions): Promise<Handle> {
  const g = canvas.getContext("2d", { alpha: false });
  if (!g) return staticHandle(opts);
  await loadFonts();
  injectStyle();
  const wd = world();
  const words: Words = { ...WORDS, ...opts.words };
  const host = opts.host ?? canvas.parentElement!;
  const maxDpr = opts.maxDpr ?? (matchMedia("(pointer: coarse)").matches ? 1.5 : 2);
  const ignore = opts.ignore ?? "a, button, input, select, textarea, summary, label, [data-chart-ignore]";

  let W = 0;
  let H = 0;
  let dpr = 1;
  let pal: Palette = palette(opts.theme);
  let reduced = !!opts.reduced;
  let mob = false;
  let st = null as unknown as ChartState;
  let dprCap = maxDpr;

  // layers: the base (tint, land, graticule, names, harbour), the contours (and routes), composed under the live fx
  const baseC = document.createElement("canvas");
  const bg = baseC.getContext("2d", { alpha: false })!;
  const ctC = document.createElement("canvas");
  const ct = ctC.getContext("2d")!;
  let tintC: HTMLCanvasElement | null = null;
  let tintFor: Theme | null = null;
  let grain: HTMLCanvasElement | null = null;
  let glow: HTMLCanvasElement | null = null;
  let baseKey = "";
  let lastC = -1e9;
  let Sg = new Float32Array(0);
  let Vg = new Float32Array(0);
  let Wg = new Float32Array(0);
  let gw = 0;
  let gh = 0;
  let cs = 8;
  let csFor = "";

  let ships: Ship[] = [];
  const shipsOf = (): Ship[] => ships;
  let hover: Ship | null = null;
  let hoverRaft = false;
  let focusShip: Ship | null = null;
  let kick = (): void => {};
  let busy = true;

  // ----- state -----
  function build(state: ChartState | undefined): void {
    st =
      state && state.v === 1 && state.ships.length === wd.ships.length
        ? structuredClone(state)
        : freshState(opts.camera, W, H, opts.theme, opts.mask ?? NOMASK, reduced);
    st.theme = opts.theme;
    if (typeof st.cz !== "number") st.cz = st.t;
    rebuildShips();
  }
  function rebuildShips(): void {
    ships = wd.ships.map((s: ShipDef, k) => ({
      i: s.i,
      x: s.x,
      y: s.y,
      hd: s.hd,
      n: s.n,
      host: s.host,
      route: wd.routes[k]!,
      run: st.ships[k]!,
      dyn: false,
      ph: s.i * 1.9,
      hv: 0,
    }));
    for (const d of st.dyn) {
      const nm = appName(d.i);
      ships.push({
        i: d.i,
        x: d.x,
        y: d.y,
        hd: 0,
        n: nm.n,
        host: nm.host,
        route: mkRoute(d.x, d.y, wd.harbour, d.off),
        run: d,
        dyn: true,
        ph: d.i * 1.9,
        hv: 0,
      });
    }
  }

  // ----- geometry -----
  const scaleOf = (): number => Math.max(W / WW, H / WH) * Math.exp(st.cam.lz);
  let sc = 1;
  const px = (x: number): number => (x - st.cam.cx) * sc + W / 2;
  const py = (y: number): number => (y - st.cam.cy) * sc + H / 2;
  const wx = (x: number): number => st.cam.cx + (x - W / 2) / sc;
  const wy = (y: number): number => st.cam.cy + (y - H / 2) / sc;
  const zoomRel = (): number => clamp(st.cam.lz / 1.2, 0, 1.2);

  function resize(): boolean {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    const d = Math.min(devicePixelRatio || 1, dprCap);
    if (w === W && h === H && d === dpr) return false;
    W = w;
    H = h;
    dpr = d;
    mob = W < 700;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    baseC.width = canvas.width;
    baseC.height = canvas.height;
    ctC.width = canvas.width;
    ctC.height = canvas.height;
    baseKey = "";
    lastC = -1e9;
    return true;
  }

  // ----- camera springs -----
  const OMEGA = 8.5;
  function stepSpring(dt: number): boolean {
    const c = st.cam;
    const tg = resolveCam(wd, c.to, W, H);
    let moving = false;
    const one = (x: number, v: number, target: number): [number, number] => {
      let n = Math.ceil(dt / 8);
      const h = dt / 1000 / Math.max(1, n);
      while (n-- > 0) {
        const a = -2 * OMEGA * v - OMEGA * OMEGA * (x - target);
        v += a * h;
        x += v * h;
      }
      return [x, v];
    };
    if (dt > 0) {
      [c.cx, c.vx] = one(c.cx, c.vx, tg.cx);
      [c.cy, c.vy] = one(c.cy, c.vy, tg.cy);
      [c.lz, c.vz] = one(c.lz, c.vz, tg.lz);
    }
    const near =
      Math.abs(c.cx - tg.cx) < 0.05 / Math.max(1, sc) &&
      Math.abs(c.cy - tg.cy) < 0.05 / Math.max(1, sc) &&
      Math.abs(c.lz - tg.lz) < 0.0004 &&
      Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.vz) < 0.02;
    if (near && dt > 0) {
      c.cx = tg.cx;
      c.cy = tg.cy;
      c.lz = tg.lz;
      c.vx = c.vy = c.vz = 0;
    } else if (!near) moving = true;
    return moving;
  }

  // ----- mask (what the text covers), eased between pages -----
  function maskNow(): Mask {
    const m = st.mask;
    const u = clamp((st.t - m.t0) / 420, 0, 1);
    if (u >= 1 || !m.from.copy || !m.to.copy) return m.to;
    const e = easeOut(u);
    const a = m.from.copy;
    const b = m.to.copy;
    return {
      copy: { x0: lerp(a.x0, b.x0, e), y0: lerp(a.y0, b.y0, e), x1: lerp(a.x1, b.x1, e), y1: lerp(a.y1, b.y1, e) },
      navH: lerp(m.from.navH, m.to.navH, e),
    };
  }
  const maskMoving = (): boolean => st.t - st.mask.t0 < 420;

  // ----- furniture layout (screen px) -----
  interface Layout {
    M: number;
    pad: number;
    compass: { x: number; y: number; r: number };
    bar: { x: number; y: number; w: number };
    legend: { x: number; y1: number; y2: number };
    hintY: number;
    capX: number;
    capY: number;
    avoid: Rect[];
  }
  function layout(m: Mask): Layout {
    const M = mob ? 17 : MARGIN;
    const pad = m.copy ? m.copy.x0 : clamp(W * 0.05, 20, 72);
    const compass = mob
      ? { x: W - 50, y: (m.copy ? m.copy.y1 : 300) + 44, r: 26 }
      : { x: W - Math.max(120, W * 0.088), y: 196, r: 62 };
    const sw = mob ? 60 : 120;
    const bar = { x: mob ? W - 20 - sw : W - pad - 4 - sw, y: mob ? H - 104 : H - 76, w: sw };
    const hintY = H - clamp(H * 0.05, 22, 44) - 8;
    const legend = { x: pad, y1: hintY - (mob ? 46 : 55), y2: hintY - (mob ? 25 : 34) };
    const capX = W - pad + 2;
    const capY = H - 34 - 6;
    const avoid: Rect[] = [
      { x0: legend.x - 14, y0: legend.y1 - 16, x1: legend.x + (mob ? 300 : 360), y1: hintY + 16 },
      { x0: bar.x - 26, y0: bar.y - 30, x1: bar.x + bar.w + 36, y1: bar.y + 30 },
      {
        x0: compass.x - compass.r - 26,
        y0: compass.y - compass.r - 26,
        x1: compass.x + compass.r + 26,
        y1: compass.y + compass.r + 26,
      },
    ];
    if (!mob) avoid.push({ x0: W - pad - 560, y0: capY - 16, x1: W - pad + 14, y1: capY + 16 });
    return { M, pad, compass, bar, legend, hintY, capX, capY, avoid };
  }

  // ----- the static field on a screen grid, for the contours -----
  function ensureGrid(): void {
    const step = st.cam.lz > 0.02 || camMoving ? (mob ? 8 : 10) : mob ? 6 : 8;
    const key = `${W}x${H}:${step}`;
    if (key === csFor) return;
    csFor = key;
    cs = step;
    gw = Math.ceil(W / cs) + 2;
    gh = Math.ceil(H / cs) + 2;
    Sg = new Float32Array(gw * gh);
    Wg = new Float32Array(gw * gh);
    Vg = new Float32Array(gw * gh);
  }
  let camMoving = false;

  // ----- the tint raster (world space, 0.5 px per unit) -----
  function ensureTint(): void {
    if (tintC && tintFor === st.theme) return;
    const x0 = -150;
    const y0 = -150;
    const tw = Math.ceil((WW + 300) / 2);
    const th = Math.ceil((WH + 300) / 2);
    const c = tintC ?? (tintC = document.createElement("canvas"));
    c.width = tw;
    c.height = th;
    const img = new ImageData(tw, th);
    const d = img.data;
    const P = pal;
    for (let j = 0; j < th; j++)
      for (let i = 0; i < tw; i++) {
        const e = S(x0 + i * 2, y0 + j * 2);
        const k = (j * tw + i) * 4;
        let r: number;
        let gg: number;
        let b: number;
        if (e > 0) {
          const t = Math.min(1, e * 1.4);
          r = lerp(P.land[0], P.land2[0], t);
          gg = lerp(P.land[1], P.land2[1], t);
          b = lerp(P.land[2], P.land2[2], t);
        } else {
          const sh = Math.exp(e * 3.3);
          const sh2 = Math.exp(e * 14) * 0.45;
          r = lerp(P.deep[0], P.shallow[0], sh) + (P.shore[0] - P.shallow[0]) * sh2;
          gg = lerp(P.deep[1], P.shallow[1], sh) + (P.shore[1] - P.shallow[1]) * sh2;
          b = lerp(P.deep[2], P.shallow[2], sh) + (P.shore[2] - P.shallow[2]) * sh2;
        }
        d[k] = r;
        d[k + 1] = gg;
        d[k + 2] = b;
        d[k + 3] = 255;
      }
    c.getContext("2d")!.putImageData(img, 0, 0);
    tintFor = st.theme;
  }
  function ensureTextures(): void {
    if (!grain) {
      grain = document.createElement("canvas");
      grain.width = grain.height = 160;
      const gx = grain.getContext("2d")!;
      const im = gx.createImageData(160, 160);
      const dd = im.data;
      let s = 5;
      const rr = (): number => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = 0; i < dd.length; i += 4) {
        const v = rr() < 0.5 ? 255 : 0;
        dd[i] = dd[i + 1] = dd[i + 2] = v;
        dd[i + 3] = rr() * 14;
      }
      gx.putImageData(im, 0, 0);
    }
    if (!glow) {
      glow = document.createElement("canvas");
      glow.width = glow.height = 96;
      const x = glow.getContext("2d")!;
      const r = x.createRadialGradient(48, 48, 0, 48, 48, 48);
      r.addColorStop(0, "rgba(255,255,255,.5)");
      r.addColorStop(0.35, "rgba(255,255,255,.16)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = r;
      x.fillRect(0, 0, 96, 96);
    }
  }
  // the glow is white; tinted per theme once
  let glowFor: string | null = null;
  let glowC: HTMLCanvasElement | null = null;
  function glowTinted(): HTMLCanvasElement {
    if (glowC && glowFor === pal.green) return glowC;
    glowC = document.createElement("canvas");
    glowC.width = glowC.height = 96;
    const x = glowC.getContext("2d")!;
    const r = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    r.addColorStop(0, `rgba(${pal.green},${pal.dark ? 0.5 : 0.38})`);
    r.addColorStop(0.35, `rgba(${pal.green},${pal.dark ? 0.16 : 0.12})`);
    r.addColorStop(1, `rgba(${pal.green},0)`);
    x.fillStyle = r;
    x.fillRect(0, 0, 96, 96);
    glowFor = pal.green;
    return glowC;
  }

  // ----- the base layer -----
  function drawBase(L: Layout, cheap: boolean): void {
    const c = bg;
    const P = pal;
    const INK = P.ink;
    ensureTint();
    ensureTextures();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = `rgb(${P.deep.join(",")})`;
    c.fillRect(0, 0, W, H);
    // world-space layers
    const tx = dpr * sc;
    c.setTransform(tx, 0, 0, tx, dpr * (W / 2 - st.cam.cx * sc), dpr * (H / 2 - st.cam.cy * sc));
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "low";
    c.drawImage(tintC!, -150, -150, tintC!.width * 2, tintC!.height * 2);
    c.lineJoin = "round";
    c.lineCap = "round";
    const lw = (w: number): number => w / sc;
    wd.paths.land.forEach((p, i) => {
      c.strokeStyle = `rgba(${INK},${((P.dark ? 0.2 : 0.26) - i * 0.012).toFixed(3)})`;
      c.lineWidth = lw(0.6);
      c.stroke(p);
    });
    c.strokeStyle = `rgba(${INK},${P.dark ? 0.22 : 0.3})`;
    c.lineWidth = lw(2.4);
    c.setLineDash([lw(0.8), lw(3.2)]);
    c.stroke(wd.paths.hachure);
    c.setLineDash([]);
    c.strokeStyle = `rgba(${P.bright},${P.dark ? 0.85 : 0.8})`;
    c.lineWidth = lw(1.05 + Math.min(0.5, (sc - 1) * 0.15));
    c.stroke(wd.paths.coast);
    harbourArt(c, lw);
    // screen-space finish: glow, vignette, grain
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (P.dark && !cheap) {
      let gl = c.createRadialGradient(W * 0.66, H * 0.5, 0, W * 0.66, H * 0.5, Math.max(W, H) * 0.7);
      gl.addColorStop(0, "rgba(60,140,150,.11)");
      gl.addColorStop(1, "rgba(60,140,150,0)");
      c.fillStyle = gl;
      c.fillRect(0, 0, W, H);
      gl = c.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
      gl.addColorStop(0, `rgba(${P.veil},0)`);
      gl.addColorStop(1, `rgba(${P.veil},${P.vignette})`);
      c.fillStyle = gl;
      c.fillRect(0, 0, W, H);
    }
    if (!cheap) {
      c.globalAlpha = P.grain / 14;
      c.fillStyle = c.createPattern(grain!, "repeat")!;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
    graticule(c, L);
    soundings(c);
    scaleBar(c, L);
    compassArt(c, L.compass.x, L.compass.y, L.compass.r);
    names(c);
  }
  function harbourArt(c: CanvasRenderingContext2D, lw: (w: number) => number): void {
    const h = wd.harbour;
    const o = h.out;
    const qx = -o[1];
    const qy = o[0];
    const Pt = (a: number, b: number): [number, number] => [
      h.coast[0] + o[0] * a + qx * b,
      h.coast[1] + o[1] * a + qy * b,
    ];
    c.save();
    c.lineCap = "round";
    const br = P_bright();
    c.strokeStyle = `rgba(${br},.9)`;
    c.lineWidth = lw(1.1);
    for (const s of [-1, 1]) {
      c.beginPath();
      let p = Pt(-2, s * 18);
      c.moveTo(p[0], p[1]);
      p = Pt(26, s * 26);
      const q = Pt(46, s * 14);
      c.quadraticCurveTo(p[0], p[1], q[0], q[1]);
      c.stroke();
      c.lineWidth = lw(2.4);
      c.strokeStyle = `rgba(${br},.35)`;
      c.beginPath();
      c.moveTo(q[0], q[1]);
      const q2 = Pt(46.1, s * 14);
      c.lineTo(q2[0], q2[1]);
      c.stroke();
      c.lineWidth = lw(1.1);
      c.strokeStyle = `rgba(${br},.9)`;
    }
    c.strokeStyle = `rgba(${br},.55)`;
    c.lineWidth = lw(0.9);
    for (let i = -3; i <= 3; i++) {
      const a = Pt(-1, i * 7);
      const b = Pt(-12 - (i & 1) * 5, i * 7);
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
    c.fillStyle = `rgba(${br},.28)`;
    for (const [a, b, w] of [
      [-22, -26, 6],
      [-24, -8, 5],
      [-23, 14, 7],
      [-30, 30, 5],
      [-30, -40, 5],
    ] as const) {
      const p = Pt(a, b);
      c.save();
      c.translate(p[0], p[1]);
      c.rotate(Math.atan2(qy, qx));
      c.fillRect(-w / 2, -w / 2, w, w * 0.8);
      c.restore();
    }
    c.restore();
    // the anchor glyph at the harbour mouth (the one accent on the static chart)
    c.save();
    c.translate(h.x, h.y);
    c.scale(1 / sc, 1 / sc);
    const k = 1 + 0.35 * zoomRel();
    c.scale(k, k);
    c.strokeStyle = `rgba(${pal.greenLine},.95)`;
    c.fillStyle = `rgb(${pal.hull})`;
    c.lineWidth = 1.15;
    c.beginPath();
    c.arc(0, 0, 7, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(0, -2.6, 1.2, 0, TAU);
    c.moveTo(0, -1.4);
    c.lineTo(0, 3.6);
    c.moveTo(-2.4, 0.2);
    c.lineTo(2.4, 0.2);
    c.moveTo(-3.4, 1.6);
    c.quadraticCurveTo(-3, 3.8, 0, 4);
    c.quadraticCurveTo(3, 3.8, 3.4, 1.6);
    c.stroke();
    c.restore();
  }
  const P_bright = (): string => pal.bright;

  function graticule(c: CanvasRenderingContext2D, L: Layout): void {
    const INK = pal.ink;
    const M = L.M;
    const o = mob ? 4 : 7;
    const bar = mob ? 4 : 5;
    const lab = !mob;
    c.save();
    c.lineWidth = 0.8;
    c.strokeStyle = `rgba(${INK},.3)`;
    c.strokeRect(M + 0.5, M + 0.5, W - 2 * M - 1, H - 2 * M - 1);
    c.strokeStyle = `rgba(${INK},.16)`;
    c.strokeRect(o + 0.5, o + 0.5, W - 2 * o - 1, H - 2 * o - 1);
    c.strokeRect(o + bar + 0.5, o + bar + 0.5, W - 2 * (o + bar) - 1, H - 2 * (o + bar) - 1);
    // levels of the graticule: a coarse one always, a finer one fading in as the chart is zoomed
    const lv = Math.log2(Math.max(0.5, sc));
    const k0 = Math.floor(lv);
    const f = lv - k0;
    const levels: [number, number][] = [[k0, 1]];
    if (f > 0.02) levels.push([k0 + 1, f]);
    const wxMin = wx(M);
    const wxMax = wx(W - M);
    const wyMin = wy(M);
    const wyMax = wy(H - M);
    // alternating segment bar along the outer lines, per major step of the coarse level
    {
      const step = 150 / 2 ** k0;
      c.fillStyle = `rgba(${INK},.34)`;
      for (let x = Math.floor(wxMin / step) * step, k = Math.floor(wxMin / step); x < wxMax + step; x += step, k++) {
        if (k & 1) continue;
        const a = Math.max(px(x), o + bar);
        const b = Math.min(px(x + step), W - o - bar);
        if (b > a) {
          c.fillRect(a, o, b - a, bar);
          c.fillRect(a, H - o - bar, b - a, bar);
        }
      }
      for (let y = Math.floor(wyMin / step) * step, k = Math.floor(wyMin / step); y < wyMax + step; y += step, k++) {
        if (k & 1) continue;
        const a = Math.max(py(y), o + bar);
        const b = Math.min(py(y + step), H - o - bar);
        if (b > a) {
          c.fillRect(o, a, bar, b - a);
          c.fillRect(W - o - bar, a, bar, b - a);
        }
      }
    }
    const lat = (y: number, dec: number): string => {
      const m = 50 * 60 + 40 - y / ARCMIN;
      const dg = Math.floor(m / 60 + 1e-9);
      return `${dg}°${(m - dg * 60).toFixed(dec).padStart(dec ? 4 : 2, "0")}′N`;
    };
    const lon = (x: number, dec: number): string => {
      const m = 4 * 60 + 20 - x / ARCMIN;
      const dg = Math.floor(m / 60 + 1e-9);
      return `${String(dg).padStart(3, "0")}°${(m - dg * 60).toFixed(dec).padStart(dec ? 4 : 2, "0")}′W`;
    };
    for (const [k, wt] of levels) {
      const step = 150 / 2 ** k;
      const tick = step / 5;
      const dec = k <= 0 ? 0 : 1;
      // minute ticks along the neatline, longer at the graticule
      c.strokeStyle = `rgba(${INK},${0.38 * wt})`;
      c.beginPath();
      for (let x = Math.ceil(wxMin / tick) * tick; x < wxMax; x += tick) {
        const sx = Math.round(px(x)) + 0.5;
        if (sx <= M || sx >= W - M) continue;
        const maj = Math.abs(x / step - Math.round(x / step)) < 0.01;
        const l = maj ? 9 : 4;
        c.moveTo(sx, M);
        c.lineTo(sx, M + l);
        c.moveTo(sx, H - M);
        c.lineTo(sx, H - M - l);
      }
      for (let y = Math.ceil(wyMin / tick) * tick; y < wyMax; y += tick) {
        const sy = Math.round(py(y)) + 0.5;
        if (sy <= M || sy >= H - M) continue;
        const maj = Math.abs(y / step - Math.round(y / step)) < 0.01;
        const l = maj ? 9 : 4;
        c.moveTo(M, sy);
        c.lineTo(M + l, sy);
        c.moveTo(W - M, sy);
        c.lineTo(W - M - l, sy);
      }
      c.stroke();
      // crosses at the intersections, dotted lines between
      c.strokeStyle = `rgba(${INK},${0.34 * wt})`;
      c.beginPath();
      for (let x = Math.ceil(wxMin / step) * step; x < wxMax; x += step)
        for (let y = Math.ceil(wyMin / step) * step; y < wyMax; y += step) {
          const sx = px(x);
          const sy = py(y);
          c.moveTo(sx - 5, sy + 0.5);
          c.lineTo(sx + 6, sy + 0.5);
          c.moveTo(sx + 0.5, sy - 5);
          c.lineTo(sx + 0.5, sy + 6);
        }
      c.stroke();
      c.setLineDash([1, 5]);
      c.strokeStyle = `rgba(${INK},${0.17 * wt})`;
      c.beginPath();
      for (let x = Math.ceil(wxMin / step) * step; x < wxMax; x += step) {
        c.moveTo(Math.round(px(x)) + 0.5, M);
        c.lineTo(Math.round(px(x)) + 0.5, H - M);
      }
      for (let y = Math.ceil(wyMin / step) * step; y < wyMax; y += step) {
        c.moveTo(M, Math.round(py(y)) + 0.5);
        c.lineTo(W - M, Math.round(py(y)) + 0.5);
      }
      c.stroke();
      c.setLineDash([]);
      // labels
      if (mob && wt < 1) continue;
      c.fillStyle = `rgba(${INK},${0.62 * wt})`;
      c.font = `500 ${mob ? 7.5 : 8.5}px ${MONO}`;
      c.letterSpacing = ".8px";
      c.textAlign = "center";
      for (let x = Math.ceil(wxMin / step) * step; x < wxMax; x += step) {
        const sx = px(x);
        if (sx < M + 30 || sx > W - M - 30) continue;
        if (lab || sx > W * 0.3) c.fillText(lon(x, dec), sx, H - o - bar - (lab ? 5 : 3.5));
      }
      for (let y = Math.ceil(wyMin / step) * step; y < wyMax; y += step) {
        const sy = py(y);
        if (sy < M + 30 || sy > H - M - 30) continue;
        if (!lab && L.compass && sy < (maskNow().copy?.y1 ?? 0) + 10) continue;
        c.save();
        c.translate(lab ? o + bar + 11 : W - o - bar - 3.5, sy);
        c.rotate(-Math.PI / 2);
        c.fillText(lat(y, dec), 0, 0);
        c.restore();
        if (lab) {
          c.save();
          c.translate(W - o - bar - 5, sy);
          c.rotate(Math.PI / 2);
          c.fillText(lat(y, dec), 0, 0);
          c.restore();
        }
      }
      c.letterSpacing = "0px";
    }
    c.restore();
  }
  function soundings(c: CanvasRenderingContext2D): void {
    const z = zoomRel();
    const t2 = sstep(0.28, 0.6, z);
    c.save();
    c.font = `500 ${mob ? 8.5 : 9.5}px ${MONO}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const x0 = wx(MARGIN + 10);
    const x1 = wx(W - MARGIN - 10);
    const y0 = wy(MARGIN + 10);
    const y1 = wy(H - MARGIN - 10);
    for (const s of wd.soundings) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const a = s.tier === 1 ? 1 : t2;
      if (a <= 0.02) continue;
      const sh = s.d < 12;
      c.fillStyle = `rgba(${pal.ink},${((sh ? 0.7 : 0.5) * a * (pal.dark ? 1 : 1.2)).toFixed(3)})`;
      c.fillText(String(s.d), px(s.x), py(s.y));
    }
    // rocks on the shoal
    const b = wd.shoal;
    c.strokeStyle = `rgba(${pal.ink},.6)`;
    c.lineWidth = 0.8;
    for (const [dx, dy] of [
      [-0.1, -0.05],
      [0.22, 0.08],
      [-0.02, 0.2],
    ] as const) {
      const x = px(b.x + dx * b.r * 2);
      const y = py(b.y + dy * b.r * 2);
      c.beginPath();
      c.moveTo(x - 3, y);
      c.lineTo(x + 3, y);
      c.moveTo(x, y - 3);
      c.lineTo(x, y + 3);
      c.stroke();
    }
    c.restore();
  }
  function names(c: CanvasRenderingContext2D): void {
    const fz = clamp(sc, 0.85, 1.45) * (mob ? 0.74 : 1);
    for (const n of wd.names) {
      const x = px(n.x);
      const y = py(n.y);
      if (x < -120 || x > W + 120 || y < -40 || y > H + 40) continue;
      c.save();
      c.textAlign = "center";
      c.translate(x, y);
      if (n.rot) c.rotate(n.rot);
      if (n.kind === "harbour") {
        c.font = `italic ${Math.round(23 * fz)}px ${SERIF}`;
        c.fillStyle = `rgba(${pal.name},.92)`;
        if (mob) c.translate(Math.min(0, W - 72 - x), 0);
      } else if (n.kind === "roads") {
        c.font = `italic ${Math.round(18 * fz)}px ${SERIF}`;
        c.fillStyle = `rgba(${pal.ink},.62)`;
      } else if (n.kind === "deeps") {
        c.font = `500 ${mob ? 8.5 : 9.5}px ${MONO}`;
        c.letterSpacing = mob ? "3px" : "5px";
        c.fillStyle = `rgba(${pal.ink},.46)`;
      } else if (n.kind === "shoal") {
        c.font = `italic ${Math.round(16 * fz)}px ${SERIF}`;
        c.fillStyle = `rgba(${pal.ink},.62)`;
      } else {
        c.font = `italic ${Math.round(14 * fz)}px ${SERIF}`;
        c.fillStyle = `rgba(${pal.ink},.58)`;
      }
      c.fillText(n.t, 0, 0);
      c.restore();
    }
  }
  function scaleBar(c: CanvasRenderingContext2D, L: Layout): void {
    // one segment is a nearest-nice fraction of a nautical mile (30 units), 28..64 px wide
    let seg = ARCMIN;
    while (seg * sc > 64) seg /= 2;
    while (seg * sc < 28) seg *= 2;
    const segPx = seg * sc;
    const n = Math.max(1, Math.round(L.bar.w / segPx));
    const s = L.bar;
    const col = pal.bright;
    c.save();
    c.lineWidth = 0.9;
    c.strokeStyle = `rgba(${col},.7)`;
    c.fillStyle = `rgba(${col},.7)`;
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) c.fillRect(s.x + i * segPx, s.y, segPx, 3.5);
      c.strokeRect(s.x + i * segPx + 0.5, s.y + 0.5, segPx, 3);
    }
    c.font = `500 8.5px ${MONO}`;
    c.textAlign = "center";
    c.fillStyle = `rgba(${col},.65)`;
    const nm = seg / ARCMIN;
    for (let i = 0; i <= n; i++)
      c.fillText(String(+(i * nm).toFixed(2)).replace(/^0\./, "."), s.x + i * segPx, s.y + 16);
    c.textAlign = "left";
    c.fillText("NM", s.x + n * segPx + 7, s.y + 16);
    c.restore();
  }
  function compassArt(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    const INK = pal.ink;
    c.save();
    c.translate(cx, cy);
    c.lineCap = "round";
    c.strokeStyle = `rgba(${INK},.6)`;
    c.fillStyle = `rgba(${INK},.6)`;
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.stroke();
    c.strokeStyle = `rgba(${INK},.34)`;
    c.beginPath();
    c.arc(0, 0, r - 6, 0, TAU);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.5, 0, TAU);
    c.stroke();
    c.strokeStyle = `rgba(${INK},.55)`;
    c.beginPath();
    for (let i = 0; i < 72; i++) {
      if (i % 18 === 0) continue;
      const a = (i * TAU) / 72;
      const rr = i % 6 === 0 ? r - 6 : r - 3.4 + (i % 2 ? 0.9 : 0);
      const s = Math.sin(a);
      const k = -Math.cos(a);
      c.moveTo(s * rr, k * rr);
      c.lineTo(s * r, k * r);
    }
    c.stroke();
    const star = (len: number, wd2: number, fill: number): void => {
      for (let q = 0; q < 4; q++) {
        c.save();
        c.rotate((q * Math.PI) / 2);
        c.beginPath();
        c.moveTo(0, -len);
        c.lineTo(wd2, -wd2);
        c.lineTo(0, 0);
        c.closePath();
        c.fillStyle = `rgba(${INK},${fill})`;
        c.fill();
        c.beginPath();
        c.moveTo(0, -len);
        c.lineTo(-wd2, -wd2);
        c.lineTo(0, 0);
        c.closePath();
        c.lineWidth = 0.8;
        c.strokeStyle = `rgba(${INK},.75)`;
        c.stroke();
        c.beginPath();
        c.moveTo(0, -len);
        c.lineTo(wd2, -wd2);
        c.stroke();
        c.restore();
      }
    };
    c.rotate(-0.12);
    c.strokeStyle = `rgba(${INK},.3)`;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16;
      const l = i % 2 ? r * 0.52 : r * 0.82;
      c.moveTo(0, 0);
      c.lineTo(Math.sin(a) * l, -Math.cos(a) * l);
    }
    c.stroke();
    c.save();
    c.rotate(Math.PI / 4);
    star(r * 0.62, r * 0.12, 0.22);
    c.restore();
    star(r * 0.9, r * 0.16, 0.55);
    c.beginPath();
    c.arc(0, 0, 2, 0, TAU);
    c.fillStyle = `rgb(${pal.deep.join(",")})`;
    c.fill();
    c.strokeStyle = `rgba(${INK},.85)`;
    c.stroke();
    c.rotate(0.12);
    c.font = `italic ${Math.round(r * 0.3)}px ${SERIF}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = `rgba(${pal.name},.9)`;
    c.fillText("N", 0, -r - Math.round(r * 0.2));
    c.font = `500 7.5px ${MONO}`;
    c.letterSpacing = "1px";
    c.fillStyle = `rgba(${INK},.55)`;
    c.fillText("VAR 7°W", 0, r + 14);
    c.restore();
  }

  // ----- the contours (animated depth lines) and the routes, on their own layer -----
  const LV = [-0.04, -0.09, -0.15, -0.22, -0.3, -0.4, -0.51, -0.63, -0.77, -0.92, -1.08, -1.26, -1.46];
  function scrimGrad(c: CanvasRenderingContext2D, m: Mask, kind: "scrim" | "cut"): void {
    const cp = m.copy;
    if (cp) {
      const cx = (cp.x0 + cp.x1) / 2;
      const cy = (cp.y0 + cp.y1) / 2;
      const rx = (cp.x1 - cp.x0) / 2 + (mob ? 90 : 150);
      const ry = (cp.y1 - cp.y0) / 2 + (mob ? 70 : 110);
      c.save();
      c.translate(cx, cy);
      c.scale(rx, ry);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      if (kind === "scrim") {
        const a = pal.scrimA;
        gr.addColorStop(0, `rgba(${pal.veil},${a})`);
        gr.addColorStop(0.45, `rgba(${pal.veil},${(a * 0.65).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${pal.veil},0)`);
      } else {
        gr.addColorStop(0, "rgba(0,0,0,.8)");
        gr.addColorStop(0.5, "rgba(0,0,0,.8)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
      }
      c.fillStyle = gr;
      c.fillRect(-1.05, -1.05, 2.1, 2.1);
      c.restore();
    }
    if (m.navH > 0) {
      const h = m.navH + 36;
      const gr = c.createLinearGradient(0, 0, 0, h);
      if (kind === "scrim") {
        gr.addColorStop(0, `rgba(${pal.veil},${pal.dark ? 0.6 : 0.7})`);
        gr.addColorStop(1, `rgba(${pal.veil},0)`);
      } else {
        gr.addColorStop(0, "rgba(0,0,0,.6)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
      }
      c.fillStyle = gr;
      c.fillRect(0, 0, W, h);
    }
  }
  function drawContours(m: Mask): void {
    ensureGrid();
    const z = (reduced ? T0 : st.cz) * 0.001;
    const gx0 = wx(0);
    const gy0 = wy(0);
    const stp = cs / sc;
    for (let j = 0, k = 0; j < gh; j++) {
      const y = gy0 + j * stp;
      for (let i = 0; i < gw; i++, k++) {
        const x = gx0 + i * stp;
        const e = S(x, y);
        const w = breath(e);
        Vg[k] = w > 0 ? e + w * anim(x, y, z) : e;
      }
    }
    const c = ct;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, W, H);
    const M = mob ? 17 : MARGIN;
    c.save();
    c.beginPath();
    c.rect(M, M, W - 2 * M, H - 2 * M);
    c.clip();
    c.lineJoin = "round";
    c.lineCap = "round";
    const INK = pal.ink;
    const sink = { moveTo: (x: number, y: number) => c.moveTo(x, y), lineTo: (x: number, y: number) => c.lineTo(x, y) };
    const half = sstep(0.3, 0.62, zoomRel());
    const lvls: [number, number][] = [];
    for (let i = 0; i < LV.length; i++) {
      const f = 1 - i / (LV.length + 1);
      lvls.push([LV[i]!, 0.15 + 0.6 * f * f]);
      if (half > 0.02 && i < LV.length - 1) lvls.push([(LV[i]! + LV[i + 1]!) / 2, (0.12 + 0.5 * f * f) * 0.7 * half]);
    }
    lvls.forEach(([L, a], idx) => {
      c.beginPath();
      march(Vg, gw, gh, cs, L, sink);
      c.strokeStyle = `rgba(${INK},${(a * pal.contourA).toFixed(3)})`;
      c.lineWidth = idx % 4 === 3 && half < 0.02 ? 1.05 : 0.7;
      c.stroke();
    });
    // routes of the vessels, dotted, to the harbour mouth
    c.setLineDash([1, 5.5]);
    c.lineWidth = 1;
    c.strokeStyle = `rgba(${INK},${pal.dark ? 0.4 : 0.5})`;
    c.beginPath();
    for (const s of ships) polyPath(c, s.route, 0, s.route.len - 12);
    c.stroke();
    c.setLineDash([]);
    c.restore();
    // the text's calm: contours and routes fall away under the copy and the header
    c.globalCompositeOperation = "destination-out";
    scrimGrad(c, m, "cut");
    c.globalCompositeOperation = "source-over";
  }
  function polyPath(c: CanvasRenderingContext2D, r: Route, d0: number, d1: number): void {
    if (d1 <= d0) return;
    const s = at(r, d0);
    c.moveTo(px(s[0]), py(s[1]));
    for (let i = 0; i < r.pts.length; i++) {
      if (r.cum[i]! <= d0) continue;
      if (r.cum[i]! >= d1) break;
      c.lineTo(px(r.pts[i]![0]), py(r.pts[i]![1]));
    }
    const e = at(r, d1);
    c.lineTo(px(e[0]), py(e[1]));
  }

  // ----- vessels -----
  const HULL = new Path2D("M8 0Q4.5-3.6-1-3.4L-6.5-2.8L-6.5 2.8L-1 3.4Q4.5 3.6 8 0Z");
  const CL = new Path2D("M-5.5 0H3.5");
  const TICK = new Path2D("M11.5 0H17.5M17.5-1.6V1.6");
  const shipScale = (): number => 1.12 * (1 + 0.3 * zoomRel());
  function setT(x: number, y: number, a: number, s: number): void {
    const c = Math.cos(a) * dpr * s;
    const n = Math.sin(a) * dpr * s;
    g!.setTransform(c, n, -n, c, x * dpr, y * dpr);
  }
  function drawShip(s: Ship, t: number): void {
    const run = s.run;
    const hd = s.hd + Math.sin(t * 0.00035 + s.ph) * 0.07;
    const bob = Math.sin(t * 0.0006 + s.ph) * 0.5;
    const x = px(s.x) + Math.cos(t * 0.0004 + s.ph) * 0.4;
    const y = py(s.y) + bob;
    const aw = run.aw;
    if (x < -30 || x > W + 30 || y < -30 || y > H + 30) return;
    if (aw > 0.02) {
      g!.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr);
      g!.globalAlpha = aw;
      g!.drawImage(glowTinted(), -26, -26, 52, 52);
      g!.globalAlpha = 1;
    }
    setT(x, y, hd, shipScale());
    g!.lineJoin = "round";
    g!.lineCap = "round";
    g!.lineWidth = 0.95;
    g!.fillStyle = `rgb(${pal.hull})`;
    g!.fill(HULL);
    if (aw > 0.02) {
      g!.fillStyle = `rgba(${pal.green},${(0.92 * aw).toFixed(3)})`;
      g!.fill(HULL);
    }
    g!.strokeStyle = aw > 0.5 ? `rgb(${pal.greenLine})` : `rgba(${pal.ink},${pal.dark ? 0.78 : 0.9})`;
    g!.stroke(HULL);
    g!.lineWidth = 0.7;
    g!.strokeStyle = aw > 0.5 ? (pal.dark ? "rgba(4,30,16,.7)" : "rgba(255,255,255,.7)") : `rgba(${pal.ink},.4)`;
    g!.stroke(CL);
    g!.strokeStyle = aw > 0.3 ? `rgba(${pal.greenLine},.75)` : `rgba(${pal.ink},.5)`;
    g!.stroke(TICK);
  }
  // the raft: two lashed logs and the sprout, in one monoline; a mooring ring marks it from the other vessels
  const LOG1 = new Path2D();
  const LOG2 = new Path2D();
  LOG1.roundRect(-10, -5.6, 20, 3.6, 1.8);
  LOG2.roundRect(-10, 2, 20, 3.6, 1.8);
  const LASH = new Path2D("M-4.5-6.6V6.6M4.5-6.6V6.6");
  const SPROUT = new Path2D("M0 0.4V-8.5");
  const LEAF1 = new Path2D("M0-5.2C0-8.6-2.8-10.4-6.2-10.2-6.2-6.8-3.6-5-0-5.2Z");
  const LEAF2 = new Path2D("M0-6.6C0-9.4 2.4-11.2 5.4-11 5.4-8.2 3-6.4 0-6.6Z");
  function drawRaft(t: number, awake: number, hv: number): void {
    const r = wd.raft;
    const k = 1.28 * (1 + 0.95 * zoomRel());
    const x = px(r.x) + Math.cos(t * 0.00031) * 0.5;
    const y = py(r.y) + Math.sin(t * 0.00052) * 0.7;
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return;
    g!.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr);
    if (awake > 0.02) {
      g!.globalAlpha = awake;
      g!.drawImage(glowTinted(), -34, -34, 68, 68);
      g!.globalAlpha = 1;
    }
    // mooring ring
    g!.lineWidth = 0.9;
    g!.lineCap = "round";
    g!.setLineDash([1.2, 4.4]);
    g!.strokeStyle = `rgba(${pal.ink},${0.55 + 0.35 * hv})`;
    g!.beginPath();
    g!.arc(0, 0, 21 * k * 0.9, 0, TAU);
    g!.stroke();
    g!.setLineDash([]);
    setT(x, y, -0.22 + Math.sin(t * 0.0003) * 0.05, k);
    g!.lineJoin = "round";
    g!.lineCap = "round";
    g!.lineWidth = 0.9;
    g!.fillStyle = `rgb(${pal.hull})`;
    g!.strokeStyle = `rgba(${pal.bright},${pal.dark ? 0.9 : 0.95})`;
    for (const p of [LOG1, LOG2]) {
      g!.fill(p);
      g!.stroke(p);
    }
    g!.lineWidth = 0.7;
    g!.strokeStyle = `rgba(${pal.ink},.55)`;
    g!.stroke(LASH);
    g!.lineWidth = 1;
    g!.strokeStyle = `rgb(${pal.greenLine})`;
    g!.fillStyle = `rgba(${pal.green},.9)`;
    g!.stroke(SPROUT);
    g!.fill(LEAF1);
    g!.fill(LEAF2);
    g!.lineWidth = 0.6;
    g!.stroke(LEAF1);
    g!.stroke(LEAF2);
    g!.setTransform(dpr, 0, 0, dpr, 0, 0);
    // a small caption under the ring
    g!.font = `500 ${mob ? 7.5 : 8.5}px ${MONO}`;
    g!.letterSpacing = "1.6px";
    g!.textAlign = "center";
    g!.fillStyle = `rgba(${pal.name},${0.6 + 0.3 * hv})`;
    g!.fillText("IKADA", x, y + 21 * k * 0.9 + 12);
    g!.letterSpacing = "0px";
  }

  // ----- labels (drawn on the canvas, so a hand-off carries them) -----
  const wcache = new Map<string, number>();
  function textW(s: string, font: string): number {
    const k = font + s;
    let w = wcache.get(k);
    if (w === undefined) {
      g!.font = font;
      w = g!.measureText(s).width;
      wcache.set(k, w);
    }
    return w;
  }
  interface Placed {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  function drawLabels(t: number, L: Layout, m: Mask): void {
    const font = `500 ${mob ? 11 : 11.5}px ${MONO}`;
    const list: { text: string; green: boolean; x: number; y: number; key: string }[] = [];
    const act = st.labels.filter((l) => l.until > t).sort((a, b) => a.t0 - b.t0);
    for (const l of act) {
      let x: number;
      let y: number;
      if (l.o === "sweep") {
        x = px(wd.harbour.x);
        y = py(wd.harbour.y) - 8;
      } else if (l.o === "raft") {
        x = px(wd.raft.x);
        y = py(wd.raft.y);
      } else {
        const s = ships.find((q) => (q.dyn ? "d" : "s") + (q.dyn ? q.i : q.i) === l.o);
        if (!s) continue;
        x = px(s.x);
        y = py(s.y);
      }
      list.push({ text: l.text, green: l.green, x, y, key: l.o });
    }
    const hv = hoverShip();
    if (hv && !list.some((l) => l.key === hv.key))
      list.push({ text: hv.text, green: hv.green, x: hv.x, y: hv.y, key: "hover" });
    if (!list.length) return;
    const placed: Placed[] = [];
    const avoid = L.avoid.slice();
    for (const l of list) {
      const parts = l.text.split("|");
      let w = 22 + 11;
      const seps = parts.length - 1;
      const sepW = textW("·", font);
      const widths = parts.map((p) => textW(p, font));
      w += widths.reduce((a, b) => a + b, 0) + seps * (sepW + textW(" ", font) * 2);
      if (w > W - 16) {
        // narrow canvas: drop the domain's tail
        parts[0] = parts[0]!.split(".").slice(0, 2).join(".");
        widths[0] = textW(parts[0], font);
        w = 33 + widths.reduce((a, b) => a + b, 0) + seps * (sepW + textW(" ", font) * 2);
      }
      const h = mob ? 25 : 26;
      let lx = clamp(l.x - w / 2, 8, W - w - 8);
      let ly = l.y - 34;
      if (ly < 70) ly = l.y + 22;
      const hit = (r: Rect, p: number): boolean =>
        lx < r.x1 + p && lx + w > r.x0 - p && ly < r.y1 + p && ly + h > r.y0 - p;
      for (const r of avoid) if (hit(r, 6)) ly = Math.min(ly, r.y0 - h - 8);
      if (m.copy && hit(m.copy, 6)) ly = Math.max(ly, m.copy.y1 + 10);
      for (let n = 0; n < 8; n++) {
        const o = placed.find((q) => Math.abs(q.x - lx) < (q.w + w) / 2 + 4 && Math.abs(q.y - ly) < h + 8);
        if (!o) break;
        ly = ly >= o.y ? o.y + h + 8 : o.y - h - 8;
      }
      ly = clamp(ly, 70, H - h - 12);
      placed.push({ x: lx, y: ly, w, h });
      const c = g!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.save();
      c.shadowColor = pal.dark ? "rgba(0,0,0,.55)" : "rgba(30,50,60,.22)";
      c.shadowBlur = 16;
      c.shadowOffsetY = 6;
      c.fillStyle = `rgba(${pal.pill},.94)`;
      c.beginPath();
      c.roundRect(lx, ly, w, h, h / 2);
      c.fill();
      c.restore();
      c.strokeStyle = pal.dark ? "rgba(170,214,218,.3)" : "rgba(40,70,90,.22)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(lx + 0.5, ly + 0.5, w - 1, h - 1, h / 2);
      c.stroke();
      // the dot
      const dy = ly + h / 2;
      if (l.green) {
        c.fillStyle = `rgb(${pal.green})`;
        c.save();
        c.shadowColor = `rgba(${pal.green},.6)`;
        c.shadowBlur = 8;
        c.beginPath();
        c.arc(lx + 13, dy, 3, 0, TAU);
        c.fill();
        c.restore();
      } else {
        c.fillStyle = `rgba(${pal.ink},.8)`;
        c.beginPath();
        c.arc(lx + 13, dy, 3, 0, TAU);
        c.fill();
      }
      c.font = font;
      c.textBaseline = "middle";
      c.textAlign = "left";
      let tx = lx + 22;
      parts.forEach((p, i) => {
        if (i) {
          tx += textW(" ", font);
          c.fillStyle = `rgba(${pal.pillDim},.9)`;
          c.fillText("·", tx, dy + 0.5);
          tx += sepW + textW(" ", font);
        }
        c.fillStyle = `rgb(${i === 0 ? pal.pillText : pal.pillText})`;
        c.fillText(p, tx, dy + 0.5);
        tx += widths[i]!;
      });
      c.textBaseline = "alphabetic";
    }
  }
  function hoverShip(): { text: string; green: boolean; x: number; y: number; key: string } | null {
    const t = st.t;
    if (hoverRaft) {
      if (st.labels.some((l) => l.o === "raft" && l.until > t)) return null;
      return { text: words.raftLabel, green: true, x: px(wd.raft.x), y: py(wd.raft.y), key: "hover:raft" };
    }
    const s = hover ?? focusShip;
    if (!s || st.labels.some((l) => l.o === keyOf(s) && l.until > t)) return null;
    const act = t < s.run.awUntil;
    const text = act ? `${s.host}|running|${s.run.ms} ms` : `${s.host}|asleep`;
    return { text, green: act, x: px(s.x), y: py(s.y), key: "hover:" + s.i };
  }

  // ----- the effects -----
  function drawFx(t: number, dt: number, L: Layout, m: Mask): boolean {
    const c = g!;
    let b = false;
    const k = Math.min(1, dt / 120);
    const h = wd.harbour;
    const hx = px(h.x);
    const hy = py(h.y);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = "round";
    // radar sweep from the harbour
    const sw = st.sweep;
    if (sw) {
      const el = t - sw.t0;
      const rot = 2600;
      const p = el / rot;
      const rangeW = sw.maxR * easeOut(el / 1500);
      const range = rangeW * sc;
      const ang = -Math.PI * 0.75 + p * TAU;
      c.lineWidth = 1;
      c.lineCap = "butt";
      for (const fr of [0.34, 0.67, 1]) {
        c.strokeStyle = `rgba(${pal.green},${pal.dark ? 0.12 : 0.2})`;
        c.beginPath();
        c.arc(hx, hy, range * fr, 0, TAU);
        c.stroke();
      }
      const slices = 26;
      const span = 1.05;
      for (let i = 0; i < slices; i++) {
        const a1 = ang - (i * span) / slices;
        const a0 = ang - ((i + 1) * span) / slices;
        const al = (pal.dark ? 0.2 : 0.26) * Math.pow(1 - i / slices, 2.2);
        c.fillStyle = `rgba(${pal.green},${al.toFixed(3)})`;
        c.beginPath();
        c.moveTo(hx, hy);
        c.arc(hx, hy, range, a0, a1);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = `rgba(${pal.green},.85)`;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(hx + Math.cos(ang) * range, hy + Math.sin(ang) * range);
      c.stroke();
      for (const s of ships) {
        const dx = s.x - h.x;
        const dy = s.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d > rangeW) continue;
        let a = Math.atan2(dy, dx) - -Math.PI * 0.75;
        a = ((a % TAU) + TAU) % TAU;
        const ph = a / TAU;
        const key = sw.id * 100 + Math.floor(p - ph + 1e-9);
        if (p >= ph && s.run.sw !== key && p - ph < 1) {
          s.run.sw = key;
          ping(s, t, false);
          sw.woken++;
        }
      }
      if (sw.woken > 0) setLabel("sweep", `sweep|${sw.woken} apps awake|~6 ms`, true, t + 1500);
      if ((sw.held && !sw.auto) || p < 1) b = true;
      else if (el > rot + 300) st.sweep = null;
      if (st.sweep && !sw.held && p >= 1 && !sw.auto) st.sweep = null;
    }
    // the harbour's beacon and the pulses of launches
    {
      const u = (t / 3400) % 1;
      c.lineWidth = 1;
      c.strokeStyle = `rgba(${pal.green},${(0.4 * (1 - u)).toFixed(3)})`;
      c.beginPath();
      c.arc(hx, hy, 9 + 16 * easeOut(u), 0, TAU);
      c.stroke();
      for (let i = st.pulses.length - 1; i >= 0; i--) {
        const u2 = (t - st.pulses[i]!) / 1300;
        if (u2 >= 1) {
          st.pulses.splice(i, 1);
          continue;
        }
        c.strokeStyle = `rgba(${pal.green},${(0.6 * (1 - u2)).toFixed(3)})`;
        c.beginPath();
        c.arc(hx, hy, 9 + 90 * easeOut(u2), 0, TAU);
        c.stroke();
        b = true;
      }
    }
    // route highlights of woken vessels
    c.lineCap = "round";
    c.lineWidth = 1.25;
    for (const s of ships) {
      const r = s.run.rt;
      if (r === null) continue;
      const age = r < 0 ? 1e6 : t - r;
      if (r >= 0 && age > 3000) {
        s.run.rt = null;
        continue;
      }
      if (r >= 0) b = true;
      const p = r < 0 ? 1 : easeOut(age / 750);
      const al = r < 0 ? 1 : age < 2300 ? 1 : 1 - (age - 2300) / 700;
      c.setLineDash([6, 5]);
      c.lineDashOffset = r < 0 ? 0 : -(age * 0.05);
      c.strokeStyle = `rgba(${pal.greenLine},${(0.9 * al).toFixed(3)})`;
      c.beginPath();
      polyPath(c, s.route, 0, s.route.len * p);
      c.stroke();
      c.setLineDash([]);
    }
    // vessels being launched along their routes
    for (let i = st.launches.length - 1; i >= 0; i--) {
      const l = st.launches[i]!;
      const rt = mkRoute(l.x, l.y, wd.harbour, l.off);
      const u = (t - l.t0) / l.dur;
      b = true;
      if (u >= 1) {
        const run: Dyn = {
          ...emptyRun(),
          i: l.i,
          x: l.x,
          y: l.y,
          off: l.off,
          aw: 1,
          awUntil: t + 2400,
          pings: [t],
          ms: wakeMs(),
          rt: null,
        };
        st.dyn.push(run);
        st.launches.splice(i, 1);
        const nm = appName(l.i);
        ships.push({
          i: l.i,
          x: l.x,
          y: l.y,
          hd: 0,
          n: nm.n,
          host: nm.host,
          route: rt,
          run,
          dyn: true,
          ph: l.i * 1.9,
          hv: 0,
        });
        setLabel("d" + l.i, `${nm.host}|deployed`, true, t + 2800);
        say(`${nm.host} deployed. Illustrative.`);
        if (st.dyn.length > 14) {
          const old = st.dyn.shift()!;
          const k2 = ships.findIndex((q) => q.dyn && q.run === old);
          if (k2 >= 0) ships.splice(k2, 1);
        }
        markersDirty = true;
        lastC = -1e9;
        continue;
      }
      const dd = rt.len * (1 - easeIO(u));
      const p = at(rt, Math.max(0, dd));
      const sx = px(p[0]);
      const sy = py(p[1]);
      c.setLineDash([1, 5]);
      c.strokeStyle = `rgba(${pal.ink},.45)`;
      c.lineWidth = 1;
      c.beginPath();
      polyPath(c, rt, 0, dd);
      c.stroke();
      c.setLineDash([7, 4]);
      c.lineDashOffset = -(t * 0.045);
      c.strokeStyle = `rgba(${pal.greenLine},.95)`;
      c.lineWidth = 1.3;
      c.beginPath();
      polyPath(c, rt, dd, rt.len);
      c.stroke();
      c.setLineDash([]);
      c.lineDashOffset = 0;
      // the hull
      setT(sx, sy, p[2] + Math.PI, shipScale());
      c.lineWidth = 0.95;
      c.fillStyle = `rgb(${pal.hull})`;
      c.fill(HULL);
      c.fillStyle = `rgba(${pal.green},.92)`;
      c.fill(HULL);
      c.strokeStyle = `rgb(${pal.greenLine})`;
      c.stroke(HULL);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // rings of woken vessels, wake state easing
    for (const s of ships) {
      const run = s.run;
      if (run.pings.length) {
        run.pings = run.pings.filter((p0) => t - p0 < 1900);
        c.lineWidth = 1;
        for (const p0 of run.pings)
          for (const off of [0, 260]) {
            const u = (t - p0 - off) / 1500;
            if (u <= 0 || u >= 1) continue;
            c.strokeStyle = `rgba(${pal.greenLine},${(0.65 * (1 - u)).toFixed(3)})`;
            c.beginPath();
            c.arc(px(s.x), py(s.y), 7 + (mob ? 44 : 56) * easeOut(u), 0, TAU);
            c.stroke();
            b = true;
          }
      }
      const tgt = t < run.awUntil ? 1 : 0;
      if (Math.abs(run.aw - tgt) > 0.01) {
        run.aw += (tgt - run.aw) * Math.min(1, tgt ? k * 2.2 : k * 0.55);
        b = true;
      } else run.aw = tgt;
      const hh = s === hover || s === focusShip ? 1 : 0;
      if (Math.abs(s.hv - hh) > 0.01) {
        s.hv += (hh - s.hv) * Math.min(1, k * 1.6);
        b = true;
      } else s.hv = hh;
    }
    for (const s of ships) drawShip(s, t);
    // raft
    {
      const rr = st.labels.some((l) => l.o === "raft" && l.until > t) ? 1 : 0;
      raftAw += (rr - raftAw) * Math.min(1, k * (rr ? 2 : 0.5));
      if (Math.abs(raftAw - rr) > 0.01) b = true;
      else raftAw = rr;
      raftHv += ((hoverRaft ? 1 : 0) - raftHv) * Math.min(1, k * 1.6);
      if (Math.abs(raftHv - (hoverRaft ? 1 : 0)) > 0.01) b = true;
      drawRaft(t, raftAw, raftHv);
    }
    // a hold charging: a ring grows under the pointer until the sweep starts
    if (pdown && !pdown.held) {
      const u = (performance.now() - pdown.t0 - CHARGE_AT) / (HOLD - CHARGE_AT);
      if (u > 0) {
        const e2 = easeOut(Math.min(1, u));
        c.setTransform(dpr, 0, 0, dpr, pdown.x * dpr, pdown.y * dpr);
        c.lineCap = "round";
        c.lineWidth = 1;
        c.strokeStyle = `rgba(${pal.green},${(0.25 + 0.25 * e2).toFixed(3)})`;
        c.beginPath();
        c.arc(0, 0, 16 + 14 * e2, 0, TAU);
        c.stroke();
        c.lineWidth = 2;
        c.strokeStyle = `rgba(${pal.greenLine},0.95)`;
        c.beginPath();
        c.arc(0, 0, 16 + 14 * e2, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, u));
        c.stroke();
        c.fillStyle = `rgba(${pal.green},${(0.08 + 0.12 * e2).toFixed(3)})`;
        c.beginPath();
        c.arc(0, 0, 16 + 14 * e2, 0, TAU);
        c.fill();
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        b = true;
      }
    }
    // hover rings
    c.lineWidth = 0.9;
    for (const s of ships) {
      if (s.hv > 0.02) {
        c.setTransform(dpr, 0, 0, dpr, px(s.x) * dpr, py(s.y) * dpr);
        const r = 13 + 4 * (1 - s.hv);
        c.strokeStyle = `rgba(${pal.name},${(0.6 * s.hv).toFixed(3)})`;
        c.beginPath();
        c.arc(0, 0, r, 0, TAU);
        c.stroke();
        c.beginPath();
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2;
          c.moveTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
          c.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
        }
        c.stroke();
      }
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the text's calm
    scrimGrad(c, m, "scrim");
    drawFurniture(t, L);
    drawLabels(t, L, m);
    return b;
  }
  let raftAw = 0;
  let raftHv = 0;
  function drawFurniture(t: number, L: Layout): void {
    const c = g!;
    const mono = (px2: number): string => `500 ${px2}px ${MONO}`;
    c.save();
    c.textBaseline = "middle";
    const fs = mob ? 9.5 : 10.5;
    c.font = mono(fs);
    c.letterSpacing = mob ? ".7px" : "1.05px";
    const rows: [number, string, boolean][] = [
      [L.legend.y1, words.legend1, false],
      [L.legend.y2, words.legend2, true],
    ];
    for (const [y, text, awake] of rows) {
      const x = L.legend.x;
      c.save();
      c.translate(x + 11, y);
      c.lineWidth = 1;
      c.fillStyle = awake ? `rgb(${pal.green})` : `rgb(${pal.hull})`;
      c.strokeStyle = awake ? `rgb(${pal.greenLine})` : `rgba(${pal.ink},.8)`;
      const p = new Path2D("M8 0Q4.5-3.6-1-3.4L-6.5-2.8V2.8L-1 3.4Q4.5 3.6 8 0Z");
      c.fill(p);
      c.stroke(p);
      c.restore();
      c.textAlign = "left";
      c.fillStyle = `rgba(${pal.ink},${pal.dark ? 0.74 : 0.85})`;
      c.fillText(text.toUpperCase(), x + 34, y + 0.5);
    }
    const hintA = st.used === null ? 1 : 1 - clamp((t - st.used) / 600, 0, 1);
    if (hintA > 0.01) {
      c.globalAlpha = hintA;
      c.letterSpacing = ".5px";
      c.font = mono(mob ? 11 : 12);
      const pulse = (t / 2000) % 1;
      const hx = L.legend.x + 3.5;
      c.fillStyle = `rgb(${pal.green})`;
      c.beginPath();
      c.arc(hx, L.hintY + 1, 3.5, 0, TAU);
      c.fill();
      c.strokeStyle = `rgba(${pal.green},${(0.55 * (1 - pulse)).toFixed(3)})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(hx, L.hintY + 1, 3.5 + 7 * pulse, 0, TAU);
      c.stroke();
      c.fillStyle = `rgba(${pal.name},${pal.dark ? 0.78 : 0.9})`;
      c.fillText(mob ? words.hintMobile : words.hintDesktop, L.legend.x + 16, L.hintY + 1.5);
      c.globalAlpha = 1;
    }
    if (!mob) {
      c.letterSpacing = "1.3px";
      c.font = mono(11);
      c.textAlign = "right";
      c.fillStyle = `rgba(${pal.ink},${pal.dark ? 0.5 : 0.75})`;
      c.fillText(words.caption.toUpperCase(), L.capX, L.capY);
    }
    c.restore();
  }

  // ----- the behaviours -----
  const wakeMs = (): number => 5 + Math.floor(Math.random() * 4);
  function setLabel(o: string, text: string, green: boolean, until: number): void {
    const ex = st.labels.find((l) => l.o === o);
    if (ex) {
      ex.text = text;
      ex.green = green;
      ex.until = until;
      return;
    }
    const act = st.labels.filter((l) => l.until > st.t && l.o !== "sweep");
    while (o !== "sweep" && act.length >= (mob ? 2 : 4)) {
      act.sort((a, b) => a.t0 - b.t0);
      act.shift()!.until = 0;
    }
    st.labels = st.labels.filter((l) => l.until > st.t - 1);
    st.labels.push({ o, text, green, t0: st.t, until });
  }
  const keyOf = (s: Ship): string => (s.dyn ? "d" : "s") + s.i;
  function ping(s: Ship, t: number, label = true): void {
    const r = s.run;
    r.ms = wakeMs();
    r.awUntil = t + 2900;
    r.pings.push(t);
    r.rt = t;
    if (label) setLabel(keyOf(s), `${s.host}|running|${r.ms} ms`, true, t + 2900);
    say(`${s.host} running, ${r.ms} milliseconds. Illustrative.`);
    updateLabel(s);
    busy = true;
  }
  function pingRaft(t: number): void {
    setLabel("raft", words.raftLabel, true, t + 3200);
    say("ikada, the design system behind Sproutboat's dashboards. MIT.");
    busy = true;
  }
  function launch(x: number, y: number, t: number): boolean {
    let r: Route | null = null;
    for (let k = 0; k < 8 && !r; k++) r = bestRoute(x, y, wd.harbour, Math.random);
    if (!r) return false;
    const i = 24 + Math.floor(Math.random() * 300);
    st.launches.push({ i, x, y, off: r.off, t0: t, dur: clamp(r.len / 0.26, 1300, 2800) });
    st.pulses.push(t);
    busy = true;
    return true;
  }
  function startSweep(t: number, auto: boolean): void {
    st.sweepSeq++;
    let m = 0;
    for (const s of ships) m = Math.max(m, Math.hypot(s.x - wd.harbour.x, s.y - wd.harbour.y));
    st.sweep = { t0: t, held: !auto, auto, id: st.sweepSeq, woken: 0, maxR: m + 40 };
    busy = true;
  }
  const inView = (s: Ship, m: Mask): boolean => {
    const x = px(s.x);
    const y = py(s.y);
    const M = mob ? 17 : MARGIN;
    if (x < M + 20 || x > W - M - 20 || y < M + 50 || y > H - M - 20) return false;
    const cp = m.copy;
    return !(cp && x > cp.x0 - 12 && x < cp.x1 + 12 && y > cp.y0 - 12 && y < cp.y1 + 12);
  };
  function freeSea(m: Mask, L: Layout): [number, number] | null {
    const M = L.M;
    for (let a = 0; a < 400; a++) {
      const sx = M + 40 + Math.random() * (W - 2 * M - 80);
      const sy = M + 60 + Math.random() * (H - 2 * M - 100);
      const x = wx(sx);
      const y = wy(sy);
      if (!wd.launchable(x, y)) continue;
      const cp = m.copy;
      if (cp && sx > cp.x0 - 30 && sx < cp.x1 + 30 && sy > cp.y0 - 30 && sy < cp.y1 + 30) continue;
      if (L.avoid.some((r) => sx > r.x0 && sx < r.x1 && sy > r.y0 && sy < r.y1)) continue;
      if (ships.some((s) => Math.hypot(px(s.x) - sx, py(s.y) - sy) < 46)) continue;
      return [x, y];
    }
    return null;
  }
  let lastInput = -1e9;
  function frameLogic(t: number, L: Layout, m: Mask): void {
    if (!reduced && t - lastInput > 3000 && t > st.demo.next) {
      st.demo.n++;
      const idle = performance.now() - inputAt > 3000;
      if (idle) {
        if (st.demo.n % 6 === 0 && st.launches.length < 1) {
          const p = freeSea(m, L);
          if (p) launch(p[0], p[1], t);
        } else {
          const cand = ships.filter((s) => t > s.run.awUntil + 400 && inView(s, m));
          const s = cand[Math.floor(Math.random() * cand.length)];
          if (s) ping(s, t);
        }
        st.demo.next = t + 1500 + Math.random() * 1000;
        if (t > st.demo.sweepAt && st.demo.n > 4) {
          st.demo.sweepAt = t + 16000 + Math.random() * 8000;
          if (!st.sweep) startSweep(t, true);
        }
      } else st.demo.next = t + 1000;
    }
  }
  let inputAt = -1e9;
  function noteInput(): void {
    inputAt = performance.now();
    lastInput = st.t;
    if (st.used === null) st.used = st.t;
  }

  // ----- DOM: marker buttons, live region -----
  const layer = opts.markers ?? null;
  let markerEls: Marker[] = [];
  let raftEl: HTMLElement | null = null;
  let liveEl: HTMLElement | null = null;
  let groupEl: HTMLElement | null = null;
  let markersDirty = true;
  const say = (s: string): void => {
    if (liveEl) liveEl.textContent = s;
  };
  function markerLabel(s: Ship): string {
    return `${s.host}, ${st.t < s.run.awUntil ? "running" : "asleep"}. Press to wake.`;
  }
  function updateLabel(s: Ship): void {
    const m = markerEls.find((q) => q.ship === s);
    if (m) m.el.setAttribute("aria-label", markerLabel(s));
  }
  function buildMarkers(): void {
    if (!layer) return;
    layer.classList.add("sbc-layer");
    layer.style.setProperty("--sbc-hit", mob ? "48px" : "40px");
    layer.style.setProperty("--sbc-accent", pal.green);
    layer.textContent = "";
    groupEl = document.createElement("div");
    groupEl.setAttribute("role", "group");
    groupEl.setAttribute("aria-label", "Apps on the chart");
    groupEl.setAttribute("aria-description", "Arrow keys move between vessels, Enter wakes one.");
    markerEls = ships.map((s) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sbc-m";
      el.tabIndex = -1;
      el.setAttribute("aria-label", markerLabel(s));
      groupEl!.appendChild(el);
      return { el, ship: s };
    });
    layer.appendChild(groupEl);
    if (opts.raftHref) {
      const a = document.createElement("a");
      a.href = opts.raftHref;
      a.className = "sbc-m";
      a.setAttribute("aria-label", "ikada, the Sproutboat design system. Zoom in to the raft.");
      raftEl = a;
    } else {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sbc-m";
      b.setAttribute("aria-label", "ikada, the raft at Sprout Harbour. Press for details.");
      raftEl = b;
    }
    layer.appendChild(raftEl);
    liveEl = document.createElement("div");
    liveEl.className = "sbc-sr";
    liveEl.setAttribute("aria-live", "polite");
    layer.appendChild(liveEl);
    const sr = document.createElement("p");
    sr.className = "sbc-sr";
    sr.textContent = `A nautical chart. Vessels are apps, each about ${"1.28 MiB"} when asleep and waking in about 6 ms; one server has held 1,000. Values on the chart are illustrative.`;
    layer.appendChild(sr);
    markersDirty = true;
  }
  let activeIdx = 0;
  function syncMarkers(m: Mask): void {
    if (!layer || !groupEl) return;
    // the layer may be offset from the canvas
    const lr = layer.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const ox = cr.left - lr.left;
    const oy = cr.top - lr.top;
    const half = (mob ? 48 : 40) / 2;
    let firstVisible = -1;
    markerEls.forEach((mk, idx) => {
      const s = mk.ship!;
      const vis = inView(s, m);
      mk.el.hidden = !vis;
      if (!vis) return;
      if (firstVisible < 0) firstVisible = idx;
      mk.el.style.transform = `translate3d(${(ox + px(s.x) - half).toFixed(1)}px,${(oy + py(s.y) - half).toFixed(1)}px,0)`;
    });
    if (markerEls[activeIdx]?.el.hidden && firstVisible >= 0) activeIdx = firstVisible;
    markerEls.forEach((mk, idx) => (mk.el.tabIndex = idx === activeIdx ? 0 : -1));
    if (raftEl) {
      const x = px(wd.raft.x);
      const y = py(wd.raft.y);
      const vis =
        x > 20 &&
        x < W - 20 &&
        y > 70 &&
        y < H - 20 &&
        !(m.copy && x > m.copy.x0 - 8 && x < m.copy.x1 + 8 && y > m.copy.y0 - 8 && y < m.copy.y1 + 8);
      raftEl.hidden = !vis;
      const rh = (mob ? 48 : 40) * 1.2;
      raftEl.style.width = raftEl.style.height = rh + "px";
      raftEl.style.transform = `translate3d(${(ox + x - rh / 2).toFixed(1)}px,${(oy + y - rh / 2).toFixed(1)}px,0)`;
    }
    markersDirty = false;
  }
  function shipOfEl(el: Element | null): Ship | null {
    const b = el?.closest?.(".sbc-m") as HTMLElement | null;
    if (!b) return null;
    return markerEls.find((q) => q.el === b)?.ship ?? null;
  }
  // ----- input -----
  let pdown: {
    x: number;
    y: number;
    moved: boolean;
    held: boolean;
    to: number;
    t0: number;
    ship: Ship | null;
    raft: boolean;
  } | null = null;
  /** a hold: the ring starts to charge after this long, the sweep starts at HOLD (ms, wall clock) */
  const CHARGE_AT = 120;
  const HOLD = 430;
  const rectOf = (): DOMRect => canvas.getBoundingClientRect();
  function onDown(e: PointerEvent): void {
    if (e.button > 0) return;
    const target = e.target as Element | null;
    const marker = target?.closest?.(".sbc-m");
    if (!marker && target?.closest?.(ignore)) return;
    if (marker && marker === raftEl && raftEl instanceof HTMLAnchorElement) return;
    const r = rectOf();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    noteInput();
    const to = window.setTimeout(() => {
      if (pdown && !pdown.moved) {
        pdown.held = true;
        startSweep(st.t, false);
        kick();
      }
    }, HOLD);
    pdown = {
      x,
      y,
      moved: false,
      held: false,
      to,
      t0: performance.now(),
      ship: shipOfEl(target),
      raft: !!marker && marker === raftEl,
    };
    kick();
  }
  function onMove(e: PointerEvent): void {
    if (!pdown) return;
    const r = rectOf();
    if (Math.hypot(e.clientX - r.left - pdown.x, e.clientY - r.top - pdown.y) > 14) pdown.moved = true;
  }
  function onUp(e: PointerEvent): void {
    if (!pdown) return;
    clearTimeout(pdown.to);
    const p = pdown;
    pdown = null;
    if (p.held) {
      if (st.sweep) st.sweep.held = false;
      kick();
      return;
    }
    if (p.moved) return;
    suppressClick = performance.now();
    if (p.ship) {
      ping(p.ship, st.t);
      kick();
      return;
    }
    if (p.raft) {
      pingRaft(st.t);
      kick();
      return;
    }
    click(p.x, p.y);
    void e;
  }
  let suppressClick = 0;
  /** may a vessel be deployed on open water at this canvas point (not land, the text, the furniture, the margin)? */
  function canDeploy(x: number, y: number): boolean {
    const m = maskNow();
    const L = layout(m);
    const M = L.M;
    if (x < M + 12 || x > W - M - 12 || y < M + 30 || y > H - M - 12 || y < Math.max(74, m.navH + 10)) return false;
    const cp = m.copy;
    if (cp && x > cp.x0 - 26 && x < cp.x1 + 26 && y > cp.y0 - 30 && y < cp.y1 + 34) return false;
    if (L.avoid.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)) return false;
    return wd.launchable(wx(x), wy(y), true);
  }
  function click(x: number, y: number): void {
    if (!canDeploy(x, y)) return;
    if (st.launches.length >= 3) return;
    launch(wx(x), wy(y), st.t);
    kick();
  }
  function onKeyClick(e: Event): void {
    // keyboard activation (Enter, Space) arrives as a click with no pointer; pointer clicks were handled on pointerup
    const ce = e as MouseEvent;
    const marker = (e.target as Element | null)?.closest?.(".sbc-m");
    if (!marker || ce.detail !== 0) return;
    noteInput();
    const s = shipOfEl(marker);
    if (s) ping(s, st.t);
    else if (marker === raftEl && !(raftEl instanceof HTMLAnchorElement)) pingRaft(st.t);
    kick();
  }
  function onKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    const idx = markerEls.findIndex((q) => q.el === t);
    if (idx < 0) return;
    const vis = markerEls.map((q, i) => (q.el.hidden ? -1 : i)).filter((i) => i >= 0);
    const at0 = vis.indexOf(idx);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = vis[(at0 + 1) % vis.length]!;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = vis[(at0 - 1 + vis.length) % vis.length]!;
    else if (e.key === "Home") next = vis[0]!;
    else if (e.key === "End") next = vis[vis.length - 1]!;
    if (next < 0) return;
    e.preventDefault();
    activeIdx = next;
    markerEls.forEach((q, i) => (q.el.tabIndex = i === next ? 0 : -1));
    markerEls[next]!.el.focus();
  }
  function onOver(e: Event): void {
    if ((e as PointerEvent).pointerType === "touch") return;
    const el = e.target as Element | null;
    const s = shipOfEl(el);
    if (s) {
      if (s !== hover) {
        hover = s;
        hoverRaft = false;
        kick();
      }
    } else if (el?.closest?.(".sbc-m") === raftEl && raftEl) {
      hoverRaft = true;
      kick();
    }
  }
  function onOut(e: Event): void {
    if ((e as PointerEvent).pointerType === "touch") return;
    const el = e.target as Element | null;
    if (shipOfEl(el)) hover = null;
    else if (el?.closest?.(".sbc-m") === raftEl) hoverRaft = false;
    kick();
  }
  function onFocusIn(e: FocusEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el?.matches?.(":focus-visible")) return;
    const s = shipOfEl(el);
    if (s) {
      focusShip = s;
      activeIdx = markerEls.findIndex((q) => q.el === el);
    } else if (el === raftEl) hoverRaft = true;
    kick();
  }
  function onFocusOut(e: FocusEvent): void {
    focusShip = null;
    if (e.target === raftEl) hoverRaft = false;
    kick();
  }

  // ----- the frame -----
  const costs: number[] = [];
  let frames = 0;
  let sumCost = 0;
  let maxCost = 0;
  const stamps: number[] = [];
  let lastTs = 0;
  let raf = 0;
  let vis = !document.hidden;
  let inViewport = true;
  let destroyed = false;
  let firstDone = false;
  let paused = false;

  function stats(): Stats {
    const sorted = costs.slice().sort((a, b) => a - b);
    const now = performance.now();
    const recent = stamps.filter((s) => now - s < 1000).length;
    return {
      backend: "canvas",
      frames,
      cpuMs: frames ? sumCost / frames : 0,
      p95Ms: sorted.length ? sorted[Math.floor(sorted.length * 0.95)]! : 0,
      maxMs: maxCost,
      fps: recent,
      dpr,
      w: W,
      h: H,
    };
  }

  function renderFrame(dt: number): boolean {
    const t0 = performance.now();
    if (dt > 0 && !(reduced && !busy && !st.sweep && st.launches.length === 0)) st.t += dt;
    const camBefore = `${st.cam.cx.toFixed(3)}|${st.cam.cy.toFixed(3)}|${st.cam.lz.toFixed(5)}`;
    camMoving = stepSpring(dt);
    sc = scaleOf();
    const camNow = `${st.cam.cx.toFixed(3)}|${st.cam.cy.toFixed(3)}|${st.cam.lz.toFixed(5)}`;
    const m = maskNow();
    const L = layout(m);
    frameLogic(st.t, L, m);
    const key = `${camNow}|${W}|${H}|${dpr}|${st.theme}|${L.compass.y.toFixed(1)}|${m.copy ? m.copy.y1.toFixed(0) : 0}|${camMoving ? "c" : "f"}`;
    if (key !== baseKey) {
      drawBase(L, camMoving);
      baseKey = key;
      markersDirty = true;
    }
    const needC = !reduced
      ? st.t - lastC >= 50 || camMoving || maskMoving()
      : lastC < 0 || camBefore !== camNow || maskMoving() || st.launches.length > 0;
    if (needC || key !== lastCKey) {
      if (dt > 0) st.cz = st.t;
      drawContours(m);
      lastC = st.t;
      lastCKey = key;
    }
    busy = false;
    g!.setTransform(1, 0, 0, 1, 0, 0);
    g!.globalAlpha = 1;
    g!.drawImage(baseC, 0, 0);
    g!.drawImage(ctC, 0, 0);
    const b = drawFx(st.t, dt, L, m);
    if (markersDirty || camMoving) syncMarkers(m);
    // labels expire
    st.labels = st.labels.filter((l) => l.until > st.t);
    const cost = performance.now() - t0;
    if (dt > 0) {
      frames++;
      sumCost += cost;
      if (cost > maxCost) maxCost = cost;
      costs.push(cost);
      if (costs.length > 240) costs.shift();
      stamps.push(performance.now());
      if (stamps.length > 130) stamps.shift();
    }
    return (
      b ||
      busy ||
      camMoving ||
      maskMoving() ||
      st.labels.some((l) => l.until < NEVER / 2) ||
      (pdown !== null && !pdown.held) ||
      hover !== null ||
      focusShip !== null
    );
  }
  let lastCKey = "";

  function loop(ts: number): void {
    raf = 0;
    if (destroyed || !vis || !inViewport || paused) return;
    const dt = Math.min(50, lastTs ? ts - lastTs : 0);
    lastTs = ts;
    const more = renderFrame(dt);
    guard(ts, dt);
    if (!reduced || more) raf = requestAnimationFrame(loop);
    else lastTs = 0;
  }
  // adaptive pixel ratio: a slow stretch steps the canvas down (never below 1)
  let slow = 0;
  function guard(_ts: number, dt: number): void {
    if (dt <= 0) return;
    if (costs.length && costs[costs.length - 1]! > 12) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 40 && dpr > 1) {
      dprCap = Math.max(1, dpr - 0.5);
      slow = 0;
      resize();
      markersDirty = true;
    }
  }
  kick = (): void => {
    if (raf || destroyed || !vis || !inViewport || paused) return;
    lastTs = 0;
    raf = requestAnimationFrame(loop);
  };

  function applyMask(m: Mask, o?: { animate?: boolean }): void {
    const cur = maskNow();
    const cut = o?.animate === false || reduced;
    st.mask = { from: cut ? maskOf(m) : maskOf(cur), to: maskOf(m), t0: cut ? -1e6 : st.t };
    markersDirty = true;
    baseKey = "";
    kick();
  }

  // the eased visuals that are not in the state (hover rings, the raft's glow) start from where a restored page starts: at rest
  function settleLocals(): void {
    for (const s of ships) s.hv = 0;
    raftHv = 0;
    raftAw = st.labels.some((l) => l.o === "raft" && l.until > st.t) ? 1 : 0;
  }

  // ----- start -----
  resize();
  build(opts.state);
  sc = scaleOf();
  if (st.cam.to !== opts.camera) st.cam.to = opts.camera;
  if (opts.state && opts.state.theme !== opts.theme) st.theme = opts.theme;
  pal = palette(st.theme);
  settleLocals();
  buildMarkers();
  renderFrame(0);
  firstDone = true;
  opts.onFirstFrame?.();
  // a carried state brings the previous page's mask: the first frame is that page's last one, then the mask eases to ours
  if (opts.state && opts.mask) applyMask(opts.mask, { animate: true });

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver((es) => {
          inViewport = es[es.length - 1]!.isIntersecting;
          if (inViewport) kick();
        })
      : null;
  io?.observe(canvas);
  const onVis = (): void => {
    vis = !document.hidden;
    if (vis) kick();
  };
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(() => {
    if (resize()) {
      // keep the camera on its preset: a resize snaps (the box changed, there is nothing to glide from)
      const tg = resolveCam(wd, st.cam.to, W, H);
      st.cam.cx = tg.cx;
      st.cam.cy = tg.cy;
      st.cam.lz = tg.lz;
      st.cam.vx = st.cam.vy = st.cam.vz = 0;
      buildMarkers();
      kick();
    }
  });
  ro.observe(canvas);
  const ac = new AbortController();
  const sig = { signal: ac.signal, passive: true } as const;
  host.addEventListener("pointerdown", onDown, sig);
  // move, up and cancel on the window: a release outside the hero (or the window) must still end the hold
  window.addEventListener("pointermove", onMove, sig);
  window.addEventListener("pointerup", onUp, sig);
  window.addEventListener(
    "pointercancel",
    () => {
      if (pdown) {
        clearTimeout(pdown.to);
        pdown = null;
        if (st.sweep) st.sweep.held = false;
        kick();
      }
    },
    sig,
  );
  // a long press on touch opens the context menu and selects text: not on the chart
  host.addEventListener(
    "contextmenu",
    (e) => {
      const t = e.target as Element | null;
      if (pdown || !t?.closest?.(ignore)) e.preventDefault();
    },
    { signal: ac.signal },
  );
  if (layer) {
    layer.addEventListener("pointerover", onOver, sig);
    layer.addEventListener("pointerout", onOut, sig);
    layer.addEventListener("focusin", onFocusIn, sig);
    layer.addEventListener("focusout", onFocusOut, sig);
    layer.addEventListener("keydown", onKeyDown, { signal: ac.signal });
    layer.addEventListener("click", onKeyClick, { signal: ac.signal });
    layer.addEventListener("contextmenu", (e) => e.preventDefault(), { signal: ac.signal });
  }
  void suppressClick;
  void firstDone;
  void shipsOf;
  void ACCT;
  void sstep;
  kick();

  const handle: Handle = {
    backend: "canvas",
    setCamera(name, o) {
      st.cam.to = name;
      if (o?.animate === false || reduced) {
        const tg = resolveCam(wd, name, W, H);
        st.cam.cx = tg.cx;
        st.cam.cy = tg.cy;
        st.cam.lz = tg.lz;
        st.cam.vx = st.cam.vy = st.cam.vz = 0;
      }
      kick();
    },
    getState() {
      return structuredClone(st);
    },
    setTheme(t) {
      st.theme = t;
      pal = palette(t);
      tintFor = null;
      baseKey = "";
      lastC = -1e9;
      layer?.style.setProperty("--sbc-accent", pal.green);
      kick();
    },
    setReduced(b) {
      if (b === reduced) return;
      reduced = b;
      if (b) {
        for (const r of st.ships) if (r.rt === -1) r.rt = null;
      }
      lastC = -1e9;
      kick();
    },
    setMask: applyMask,
    snapshot(type = "image/png", quality) {
      try {
        const keep = [hover, focusShip, hoverRaft] as const;
        hover = null;
        focusShip = null;
        hoverRaft = false;
        settleLocals();
        renderFrame(0);
        const url = canvas.toDataURL(type, quality);
        hover = keep[0];
        focusShip = keep[1];
        hoverRaft = keep[2];
        return url;
      } catch {
        return null;
      }
    },
    stats,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      kick();
    },
    running: () => !paused && vis && inViewport && !destroyed,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro.disconnect();
      ac.abort();
      document.removeEventListener("visibilitychange", onVis);
      if (layer) layer.textContent = "";
    },
    vessels() {
      const m = maskNow();
      return ships.map((s) => ({ i: s.i, host: s.host, x: px(s.x), y: py(s.y), visible: inView(s, m) }));
    },
    raftPoint: () => ({ x: px(wd.raft.x), y: py(wd.raft.y) }),
    wake(i) {
      const s = ships[i];
      if (s) {
        noteInput();
        ping(s, st.t);
        kick();
      }
    },
    canDeploy,
    deploy(x, y) {
      noteInput();
      const n = st.launches.length;
      click(x, y);
      return st.launches.length > n;
    },
    sweep() {
      noteInput();
      startSweep(st.t, true);
      kick();
    },
  };
  return handle;
}

function staticHandle(opts: MountOptions): Handle {
  const none = (): void => {};
  const state = freshState(opts.camera, 1440, 900, opts.theme, opts.mask ?? NOMASK, !!opts.reduced);
  return {
    backend: "static",
    setCamera: none,
    getState: () => state,
    setTheme: none,
    setReduced: none,
    setMask: none,
    snapshot: () => null,
    stats: () => ({ backend: "static", frames: 0, cpuMs: 0, p95Ms: 0, maxMs: 0, fps: 0, dpr: 1, w: 0, h: 0 }),
    pause: none,
    resume: none,
    running: () => false,
    destroy: none,
    vessels: () => [],
    raftPoint: () => ({ x: 0, y: 0 }),
    wake: none,
    deploy: () => false,
    canDeploy: () => false,
    sweep: none,
  };
}
