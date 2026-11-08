// The chart's world: one deterministic map (seeded, no DOM, no Math.random) in "chart units". The frame is 1440 x 900
// units (the 16:10 sheet the mock was drawn on); everything is a pure function of the constants below, so every page
// that mounts the chart draws the identical coast, contours, soundings and fleet, whatever its camera or size.
// The sea's slow drift (anim) is the only thing that moves, and it is a pure function of the clock.

export const WW = 1440;
export const WH = 900;
/** margin of the neatline, CSS px (screen furniture, not world) */
export const MARGIN = 27;

export type V2 = [number, number];

export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- noise (improved Perlin, seeded permutation) ----------
const perm = new Uint8Array(512);
{
  const r = rng(11);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
}
const fd = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lp = (a: number, b: number, t: number) => a + t * (b - a);
function gr(h: number, x: number, y: number, z: number): number {
  h &= 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
export function noise(x: number, y: number, z: number): number {
  let X = Math.floor(x);
  let Y = Math.floor(y);
  let Z = Math.floor(z);
  x -= X;
  y -= Y;
  z -= Z;
  X &= 255;
  Y &= 255;
  Z &= 255;
  const u = fd(x);
  const v = fd(y);
  const w = fd(z);
  const A = perm[X]! + Y;
  const AA = perm[A]! + Z;
  const AB = perm[A + 1]! + Z;
  const B = perm[X + 1]! + Y;
  const BA = perm[B]! + Z;
  const BB = perm[B + 1]! + Z;
  return lp(
    lp(
      lp(gr(perm[AA]!, x, y, z), gr(perm[BA]!, x - 1, y, z), u),
      lp(gr(perm[AB]!, x, y - 1, z), gr(perm[BB]!, x - 1, y - 1, z), u),
      v,
    ),
    lp(
      lp(gr(perm[AA + 1]!, x, y, z - 1), gr(perm[BA + 1]!, x - 1, y, z - 1), u),
      lp(gr(perm[AB + 1]!, x, y - 1, z - 1), gr(perm[BB + 1]!, x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** the sea's slow drift: added to the static depth field where the water is deep enough to breathe */
export function anim(x: number, y: number, t: number): number {
  const qx = x / 800 + t * 0.012;
  const qy = y / 800;
  return (
    0.17 * noise(qx * 1.7, qy * 1.7, t * 0.055) +
    0.075 * noise(qx * 3.4 + 5, qy * 3.4 + 5, t * 0.09) +
    0.03 * noise(qx * 7.1 + 11, qy * 7.1 + 3, t * 0.15)
  );
}

// ---------- the static field: land > 0, sea < 0 (units of depth) ----------
const C: V2 = [WW * 0.985, WH * 1.03];
const RL = WH * 0.62;
const DIR: V2 = [-0.73, -0.68];
const BAY: V2 = [C[0] + DIR[0] * RL, C[1] + DIR[1] * RL];
const ISLET: V2 = [WW * 0.665, WH * 0.4];
const SHOAL: V2 = [WW * 0.45, WH * 0.77];

function base(x: number, y: number): number {
  let e = (RL - Math.hypot(x - C[0], y - C[1])) / RL;
  const qx = x / 800;
  const qy = y / 800;
  e +=
    0.21 * noise(qx * 1.15 + 3.1, qy * 1.15 + 1.7, 0.37) +
    0.085 * noise(qx * 2.4 + 9, qy * 2.4 + 4, 1.3) +
    0.03 * noise(qx * 5.1 + 2, qy * 5.1 + 8, 2.9);
  const a = x - BAY[0];
  const b = y - BAY[1];
  return e - 0.2 * Math.exp(-(a * a + b * b) / (2 * 58 * 58));
}
const ISL_A = 0.07 - base(ISLET[0], ISLET[1]);
const SHO_A = -0.075 - base(SHOAL[0], SHOAL[1]);
const ISL_R = 26;
const SHO_R = 62;
function exact(x: number, y: number): number {
  let e = base(x, y);
  let a = x - ISLET[0];
  let b = y - ISLET[1];
  e += ISL_A * Math.exp(-(a * a + b * b) / (2 * ISL_R * ISL_R));
  a = x - SHOAL[0];
  b = y - SHOAL[1];
  return e + SHO_A * Math.exp(-(a * a + b * b) / (2 * SHO_R * SHO_R));
}

// the field sampled once on a 3-unit grid over the frame and a margin; everything else reads it bilinearly
export const GRID = { x0: -150, y0: -150, cs: 3, gw: 0, gh: 0 };
GRID.gw = Math.ceil((WW + 300) / GRID.cs) + 2;
GRID.gh = Math.ceil((WH + 300) / GRID.cs) + 2;
let sField: Float32Array | null = null;
function field(): Float32Array {
  if (sField) return sField;
  const d = new Float32Array(GRID.gw * GRID.gh);
  for (let j = 0; j < GRID.gh; j++)
    for (let i = 0; i < GRID.gw; i++) d[j * GRID.gw + i] = exact(GRID.x0 + i * GRID.cs, GRID.y0 + j * GRID.cs);
  return (sField = d);
}
/** depth field at a world point (bilinear from the grid) */
export function S(x: number, y: number): number {
  const f = field();
  const fx = clamp((x - GRID.x0) / GRID.cs, 0, GRID.gw - 1.001);
  const fy = clamp((y - GRID.y0) / GRID.cs, 0, GRID.gh - 1.001);
  const i = fx | 0;
  const j = fy | 0;
  const tx = fx - i;
  const ty = fy - j;
  const k = j * GRID.gw + i;
  return lerp(lerp(f[k]!, f[k + 1]!, tx), lerp(f[k + GRID.gw]!, f[k + GRID.gw + 1]!, tx), ty);
}
/** how much of the sea breathes at a depth: 0 in the shallows, 1 in the deeps */
export const breath = (e: number): number => sstep(0.16, 0.5, -e);

// ---------- marching squares ----------
type Sink = { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void };
/** contour of level L over a node grid v (gw x gh, spacing cs, origin ox, oy), appended to c */
export function march(v: Float32Array, gw: number, gh: number, cs: number, L: number, c: Sink, ox = 0, oy = 0): void {
  for (let j = 0; j < gh - 1; j++) {
    const row = j * gw;
    const y0 = oy + j * cs;
    const y1 = y0 + cs;
    for (let i = 0; i < gw - 1; i++) {
      const a = v[row + i]!;
      const b = v[row + i + 1]!;
      const cc = v[row + gw + i + 1]!;
      const d = v[row + gw + i]!;
      const k = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (cc > L ? 4 : 0) | (d > L ? 8 : 0);
      if (k === 0 || k === 15) continue;
      const x0 = ox + i * cs;
      const x1 = x0 + cs;
      const tx = x0 + (cs * (L - a)) / (b - a);
      const bx = x0 + (cs * (L - d)) / (cc - d);
      const ly = y0 + (cs * (L - a)) / (d - a);
      const ry = y0 + (cs * (L - b)) / (cc - b);
      switch (k) {
        case 1:
        case 14:
          c.moveTo(x0, ly);
          c.lineTo(tx, y0);
          break;
        case 2:
        case 13:
          c.moveTo(tx, y0);
          c.lineTo(x1, ry);
          break;
        case 3:
        case 12:
          c.moveTo(x0, ly);
          c.lineTo(x1, ry);
          break;
        case 4:
        case 11:
          c.moveTo(x1, ry);
          c.lineTo(bx, y1);
          break;
        case 5:
          c.moveTo(x0, ly);
          c.lineTo(tx, y0);
          c.moveTo(x1, ry);
          c.lineTo(bx, y1);
          break;
        case 6:
        case 9:
          c.moveTo(tx, y0);
          c.lineTo(bx, y1);
          break;
        case 7:
        case 8:
          c.moveTo(x0, ly);
          c.lineTo(bx, y1);
          break;
        case 10:
          c.moveTo(tx, y0);
          c.lineTo(x1, ry);
          c.moveTo(x0, ly);
          c.lineTo(bx, y1);
          break;
      }
    }
  }
}

// ---------- the places ----------
export interface Harbour {
  x: number;
  y: number;
  out: V2;
  coast: V2;
}
export interface NameDef {
  t: string;
  x: number;
  y: number;
  kind: "harbour" | "roads" | "deeps" | "shoal" | "islet";
  rot?: number;
}
export interface Route {
  pts: V2[];
  cum: number[];
  len: number;
  off: number;
}
export interface ShipDef {
  i: number;
  x: number;
  y: number;
  hd: number;
  n: string;
  host: string;
  off: number;
}
export interface Sounding {
  x: number;
  y: number;
  d: number;
  tier: 1 | 2;
}

export const HOSTN = [
  "invoice",
  "notes",
  "api",
  "blog",
  "cron",
  "auth",
  "feed",
  "hooks",
  "shop",
  "docs",
  "billing",
  "search",
  "forms",
  "chat",
  "status",
  "links",
  "mail",
  "maps",
  "todo",
  "pay",
  "images",
  "ping",
  "cart",
  "admin",
];
export const ACCT = ["acme", "acme", "lumen", "northwind", "acme", "lumen", "globex", "northwind"];
const EXTRA = [
  "notes",
  "blog",
  "api",
  "cron",
  "hooks",
  "docs",
  "auth",
  "feed",
  "cart",
  "search",
  "images",
  "ping",
  "todo",
  "chat",
  "pay",
  "links",
  "status",
  "forms",
  "mail",
  "maps",
];

/** a name for the i-th app: the first 24 are fixed, later ones are derived (and used by vessels launched by clicks) */
export function appName(i: number): { n: string; host: string } {
  const n = i < HOSTN.length ? HOSTN[i]! : `${EXTRA[i % EXTRA.length]}-${100 + ((i * 37) % 900)}`;
  return { n, host: `${n}.${ACCT[i % ACCT.length]}.sproutboat.app` };
}

export function mkRoute(x: number, y: number, h: Harbour, off: number): Route {
  const dx = h.x - x;
  const dy = h.y - y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const cx = (x + h.x) / 2 + nx * off * len;
  const cy = (y + h.y) / 2 + ny * off * len;
  const N = 56;
  const pts: V2[] = [];
  const cum = [0];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push([a * x + b * cx + c * h.x, a * y + b * cy + c * h.y]);
    if (i) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  }
  return { pts, cum, len: cum[N]!, off };
}
export function routeOK(r: Route): boolean {
  for (let i = 0; i < r.pts.length - 2; i += 2) {
    const p = r.pts[i]!;
    if (S(p[0], p[1]) > -0.025) return false;
    if (p[0] < MARGIN || p[0] > WW - MARGIN || p[1] < MARGIN || p[1] > WH - MARGIN) return false;
  }
  return true;
}
/** the first route from (x, y) to the harbour mouth that stays on water; `rnd` picks the side and the bow */
export function bestRoute(x: number, y: number, h: Harbour, rnd: () => number): Route | null {
  const sg = rnd() < 0.5 ? 1 : -1;
  const b = 0.07 + rnd() * 0.1;
  for (const o of [b * sg, -b * sg, b * 0.4 * sg, -b * 0.4 * sg, 0, b * 1.8 * sg, -b * 1.8 * sg]) {
    const r = mkRoute(x, y, h, o);
    if (routeOK(r)) return r;
  }
  return null;
}
/** point and heading at distance d along a route */
export function at(r: Route, d: number): [number, number, number] {
  d = clamp(d, 0, r.len);
  let lo = 0;
  let hi = r.cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r.cum[m]! <= d) lo = m;
    else hi = m;
  }
  const t = (d - r.cum[lo]!) / (r.cum[hi]! - r.cum[lo]! || 1);
  const a = r.pts[lo]!;
  const b = r.pts[hi]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
}

export interface World {
  harbour: Harbour;
  raft: { x: number; y: number; hd: number };
  islet: { x: number; y: number; r: number };
  shoal: { x: number; y: number; r: number };
  names: NameDef[];
  ships: ShipDef[];
  routes: Route[];
  soundings: Sounding[];
  /** where a vessel may not be placed or launched (the headline's calm sea in the wide view), world rects */
  quiet: { x0: number; y0: number; x1: number; y1: number }[];
  /** the grid of static depths (3 units), for the screen-grid contours */
  paths: { land: Path2D[]; hachure: Path2D; coast: Path2D };
  /** is this world point sea deep enough for a vessel to be launched on */
  launchable(x: number, y: number, manual?: boolean): boolean;
}

let cached: World | null = null;
export function world(): World {
  if (cached) return cached;
  const f = field();
  // harbour: the first water on the ray from the land's centre outward
  const out = DIR;
  let hp: V2 = BAY;
  for (let d = RL * 0.55; d < RL * 1.5; d += 1.5) {
    const x = C[0] + out[0] * d;
    const y = C[1] + out[1] * d;
    if (exact(x, y) < 0) {
      hp = [x, y];
      break;
    }
  }
  const harbour: Harbour = { x: hp[0] + out[0] * 6, y: hp[1] + out[1] * 6, out, coast: hp };
  const perp: V2 = [-out[1], out[0]];

  // the raft rides in the harbour's roads, a little off the mouth
  let raft = {
    x: harbour.x + out[0] * 52 + perp[0] * 30,
    y: harbour.y + out[1] * 52 + perp[1] * 30,
    hd: Math.atan2(-perp[1], -perp[0]) + 0.35,
  };
  for (let d = 44; d < 130; d += 4) {
    const x = harbour.x + out[0] * d + perp[0] * 30;
    const y = harbour.y + out[1] * d + perp[1] * 30;
    if (exact(x, y) < -0.1) {
      raft = { x, y, hd: raft.hd };
      break;
    }
  }

  const quiet = [
    { x0: 0, y0: 0, x1: 780, y1: 520 },
    { x0: 0, y0: 0, x1: WW, y1: 62 },
    { x0: 0, y0: 760, x1: 340, y1: WH },
    { x0: 600, y0: 836, x1: WW, y1: WH },
  ];
  const inQuiet = (x: number, y: number, p = 0): boolean =>
    quiet.some((r) => x > r.x0 - p && x < r.x1 + p && y > r.y0 - p && y < r.y1 + p);

  const names: NameDef[] = [
    { t: "Sprout Harbour", x: harbour.coast[0] - out[0] * 34, y: harbour.coast[1] - out[1] * 34, kind: "harbour" },
    { t: "The Roads", x: harbour.x + out[0] * 70 - 50, y: harbour.y + out[1] * 70 + 14, kind: "roads", rot: -0.12 },
    { t: "IDLE DEEPS", x: WW * 0.3, y: WH * 0.84, kind: "deeps" },
    { t: "Cold Start Shoal", x: SHOAL[0], y: SHOAL[1] + SHO_R * 0.78 + 18, kind: "shoal" },
    { t: "Wake Islet", x: ISLET[0], y: ISLET[1] - ISL_R - 12, kind: "islet" },
  ];

  // vessels: seeded scatter over the open sea, then a small fleet in the harbour's approaches
  const rnd = rng(2026 + 160);
  const ships: ShipDef[] = [];
  const bumpAvoid = [
    { x: ISLET[0], y: ISLET[1], r: ISL_R * 2.1 + 34 },
    { x: SHOAL[0], y: SHOAL[1], r: SHO_R * 2.1 + 34 },
  ];
  const add = (x: number, y: number, r: Route): void => {
    const i = ships.length;
    const nm = appName(i);
    ships.push({ i, x, y, hd: rnd() * Math.PI * 2, n: nm.n, host: nm.host, off: r.off });
  };
  for (let a = 0; a < 9000 && ships.length < 24; a++) {
    const x = MARGIN + 34 + rnd() * (WW - 2 * MARGIN - 68);
    const y = MARGIN + 34 + rnd() * (WH - 2 * MARGIN - 68);
    if (exact(x, y) > -0.17 || inQuiet(x, y, 14)) continue;
    if (Math.hypot(x - harbour.x, y - harbour.y) < 150) continue;
    if (bumpAvoid.some((b) => Math.hypot(x - b.x, y - b.y) < b.r)) continue;
    if (ships.some((s) => Math.hypot(s.x - x, s.y - y) < 84)) continue;
    const r = bestRoute(x, y, harbour, rnd);
    if (r) add(x, y, r);
  }
  const mainCount = ships.length;
  for (let a = 0; a < 4000 && ships.length < mainCount + 10; a++) {
    const ang = Math.atan2(out[1], out[0]) + (rnd() - 0.5) * 2.3;
    const d = 95 + rnd() * 210;
    const x = harbour.x + Math.cos(ang) * d;
    const y = harbour.y + Math.sin(ang) * d;
    if (exact(x, y) > -0.12 || inQuiet(x, y, 6)) continue;
    if (Math.hypot(x - raft.x, y - raft.y) < 46) continue;
    if (bumpAvoid.some((b) => Math.hypot(x - b.x, y - b.y) < b.r)) continue;
    if (ships.some((s) => Math.hypot(s.x - x, s.y - y) < 54)) continue;
    const r = bestRoute(x, y, harbour, rnd);
    if (r) add(x, y, r);
  }
  const routes = ships.map((s) => mkRoute(s.x, s.y, harbour, s.off));

  // soundings: a jittered grid of depths on the sea, a finer second tier that appears when the chart is zoomed
  const soundings: Sounding[] = [];
  // screen furniture of the wide view (compass, legend and hint, scale bar and caption): no soundings under it
  const furniture = [
    { x0: 1215, y0: 100, x1: 1415, y1: 300 },
    { x0: 30, y0: 765, x1: 440, y1: 885 },
    { x0: 780, y0: 805, x1: 1415, y1: 885 },
  ];
  const near = (x: number, y: number): boolean =>
    furniture.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) ||
    ships.some((s) => Math.hypot(s.x - x, s.y - y) < 30) ||
    names.some((n) => Math.abs(n.x - x) < 70 && Math.abs(n.y - y) < 20) ||
    Math.hypot(x - harbour.x, y - harbour.y) < 60 ||
    Math.hypot(x - raft.x, y - raft.y) < 34;
  for (const [tier, seed, cell] of [
    [1, 77, 92],
    [2, 78, 46],
  ] as const) {
    const r = rng(seed);
    for (let y = MARGIN + 30; y < WH - MARGIN - 20; y += cell)
      for (let x = MARGIN + 30; x < WW - MARGIN - 20; x += cell) {
        const px = x + (r() - 0.5) * cell * 0.8;
        const py = y + (r() - 0.5) * cell * 0.8;
        const pr = r();
        const jit = r();
        const e = S(px, py) + breath(S(px, py)) * anim(px, py, 0);
        if (e > -0.07 || pr < 0.2 || px < MARGIN + 60) continue;
        if (tier === 1 && inQuiet(px, py, 8) && px < 780 && py < 520) continue;
        if (near(px, py)) continue;
        if (tier === 2 && soundings.some((q) => q.tier === 1 && Math.hypot(q.x - px, q.y - py) < 30)) continue;
        soundings.push({ x: px, y: py, d: Math.max(2, Math.round(-e * 40 + (jit - 0.5) * 2)), tier });
      }
  }

  // static vector strokes in world space (stroked later under the camera's transform)
  const land: Path2D[] = [];
  for (const L of [0.1, 0.2, 0.3, 0.42, 0.55, 0.7, 0.86, 1.05]) {
    const p = new Path2D();
    march(f, GRID.gw, GRID.gh, GRID.cs, L, p, GRID.x0, GRID.y0);
    land.push(p);
  }
  const hachure = new Path2D();
  march(f, GRID.gw, GRID.gh, GRID.cs, 0.035, hachure, GRID.x0, GRID.y0);
  const coast = new Path2D();
  march(f, GRID.gw, GRID.gh, GRID.cs, 0, coast, GRID.x0, GRID.y0);

  cached = {
    harbour,
    raft,
    islet: { x: ISLET[0], y: ISLET[1], r: ISL_R },
    shoal: { x: SHOAL[0], y: SHOAL[1], r: SHO_R },
    names,
    ships,
    routes,
    soundings,
    quiet,
    paths: { land, hachure, coast },
    // the idle demo launches far from the harbour in deep water; a press may launch anywhere on the sea
    launchable: (x, y, manual = false) =>
      S(x, y) < (manual ? -0.1 : -0.2) &&
      !bumpAvoid.some((b) => Math.hypot(x - b.x, y - b.y) < b.r * (manual ? 0.5 : 0.8)) &&
      Math.hypot(x - harbour.x, y - harbour.y) > (manual ? 34 : 110) &&
      Math.hypot(x - raft.x, y - raft.y) > (manual ? 26 : 60),
  };
  return cached;
}
