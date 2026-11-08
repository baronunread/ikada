// Geometry of the raft for the engineering sheet. Everything is generated in SCREEN coordinates so strokes stay a
// constant width. Isometric: x runs right-down, y runs left-down, z is up; the viewer sits at (+x, +y, +z).
export type V = [number, number];
export type Kind = "main" | "fine" | "center" | "dash" | "acc" | "accfine";
export interface Seg {
  d: string;
  k: Kind;
}
export interface PartGeo {
  /** painted back to front; the fill hides what is behind */
  fills: string[];
  segs: Seg[];
  /** where the leader attaches (screen) */
  anchor: V;
  /** the part's hit outline */
  hit: string;
}
const C = Math.cos(Math.PI / 6);
const f = (n: number): string => (Math.round(n * 10) / 10).toString();
export const poly = (pts: V[], close = false): string =>
  "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + (close ? "Z" : "");

export interface Iso {
  P(x: number, y: number, z: number): V;
  s: number;
}
export function makeIso(
  s: number,
  ox: number,
  oy: number,
  bounds?: { x0: number; y0: number; x1: number; y1: number },
): Iso {
  return {
    s,
    P(x, y, z) {
      const p: V = [ox + (x - y) * C * s, oy + ((x + y) * 0.5 - z) * s];
      if (bounds) {
        bounds.x0 = Math.min(bounds.x0, p[0]);
        bounds.x1 = Math.max(bounds.x1, p[0]);
        bounds.y0 = Math.min(bounds.y0, p[1]);
        bounds.y1 = Math.max(bounds.y1, p[1]);
      }
      return p;
    },
  };
}

function box(
  I: Iso,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): { faces: string[]; sil: string } {
  const { P } = I;
  return {
    faces: [
      poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], true),
      poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], true),
      poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], true),
    ],
    sil: poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)], true),
  };
}
/** a circle in the YZ plane at x */
const yz = (I: Iso, x: number, cy: number, cz: number, r: number, t0 = 0, t1 = Math.PI * 2, n = 40): V[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return I.P(x, cy + r * Math.cos(t), cz + r * Math.sin(t));
  });
/** a circle in the XY plane at z */
const xy = (I: Iso, cx: number, cy: number, z: number, r: number, t0 = 0, t1 = Math.PI * 2, n = 36): V[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return I.P(cx + r * Math.cos(t), cy + r * Math.sin(t), z);
  });

// ------------------------------------------------------------------ the raft (units ≈ mm / 4)
export const R = {
  logLen: 200,
  logR: 17,
  logY: 27,
  logZ: 17,
  boardW: 34,
  boardL: 108,
  boardT: 7,
  pitch: 52,
  lashX: 26,
  zBoard: 92,
  zSprout: 166,
  zLash: -92,
  stem: 58,
};

function log(I: Iso, y: number): PartGeo {
  const { P } = I;
  const x0 = -R.logLen / 2;
  const x1 = R.logLen / 2;
  const z = R.logZ;
  const r = R.logR;
  const t1 = -Math.PI / 4;
  const t2 = (3 * Math.PI) / 4;
  const at = (x: number, t: number): V => P(x, y + r * Math.cos(t), z + r * Math.sin(t));
  const cap1 = yz(I, x1, y, z, r);
  const far = yz(I, x0, y, z, r, t1, t2, 24);
  const nearArc = yz(I, x1, y, z, r, t2, t1 + Math.PI * 2, 24);
  const sil = poly([at(x0, t1), at(x1, t1), ...nearArc, at(x0, t2), ...far.slice().reverse()], true);
  const segs: Seg[] = [
    { d: poly([at(x0, t1), at(x1, t1)]), k: "main" },
    { d: poly([at(x0, t2), at(x1, t2)]), k: "main" },
    { d: poly(far), k: "main" },
    { d: poly(cap1, true), k: "main" },
    { d: poly(yz(I, x1, y, z, r * 0.68), true), k: "fine" },
    { d: poly(yz(I, x1, y, z, r * 0.36), true), k: "fine" },
    { d: poly([P(x1, y, z - 1.2), P(x1, y, z + 1.2)]), k: "fine" },
  ];
  // bark: short strokes along the visible side
  const bark: [number, number, number][] = [
    [0.15, -78, -40],
    [0.78, -64, 10],
    [1.4, -90, -12],
    [2.05, -52, 30],
    [0.4, 18, 66],
    [1.1, 34, 80],
    [1.8, 8, 52],
  ];
  for (const [t, a, b] of bark) segs.push({ d: poly([at(a, t), at(b, t)]), k: "fine" });
  return { fills: [sil], segs, anchor: P(x1, y - r, z), hit: sil };
}

function board(I: Iso, x: number, z0: number): { fills: string[]; segs: Seg[]; sil: string } {
  const b = box(I, x - R.boardW / 2, x + R.boardW / 2, -R.boardL / 2, R.boardL / 2, z0, z0 + R.boardT);
  const { P } = I;
  const segs: Seg[] = b.faces.map((d) => ({ d, k: "main" as Kind }));
  // grain on the top face
  for (const u of [-0.25, 0.1, 0.35])
    segs.push({
      d: poly([
        P(x + u * R.boardW, -R.boardL / 2 + 8, z0 + R.boardT),
        P(x + u * R.boardW, R.boardL / 2 - 8, z0 + R.boardT),
      ]),
      k: "fine",
    });
  // the two nails per board
  return { fills: [b.sil], segs, sil: b.sil };
}

export function buildIso(I: Iso): {
  lashings: PartGeo;
  buoy: PartGeo;
  logA: PartGeo;
  logB: PartGeo;
  cleat: PartGeo;
  boards: PartGeo;
  sprout: PartGeo;
  axes: Seg[];
  tops: { logTop: V; boardsTop: V; sproutBase: V };
} {
  const { P } = I;
  // ---- boards
  const bx = [-R.pitch, 0, R.pitch];
  const bs = bx.map((x) => board(I, x, R.zBoard));
  const boards: PartGeo = {
    fills: bs.flatMap((b) => b.fills),
    segs: bs.flatMap((b) => b.segs),
    anchor: P(R.pitch + R.boardW / 2, -R.boardL / 2 + 6, R.zBoard + R.boardT * 0.6),
    hit: bs.map((b) => b.sil).join(""),
  };
  // ---- logs
  const logA = log(I, -R.logY);
  const logB = log(I, R.logY);
  // ---- lashings: stadium loops round both logs, dropped below
  const loops: Seg[] = [];
  const fills: string[] = [];
  const anchors: V[] = [];
  for (const x of [-R.lashX, R.lashX]) {
    const zc = R.logZ + R.zLash;
    const stad = (rr: number): V[] => {
      const pts: V[] = [];
      const cyL = -R.logY;
      const cyR = R.logY;
      const n = 22;
      for (let i = 0; i <= n; i++) pts.push(P(x, cyL + ((cyR - cyL) * i) / n, zc + rr));
      for (let i = 1; i < n; i++) {
        const t = Math.PI / 2 - (Math.PI * i) / n;
        pts.push(P(x, cyR + rr * Math.cos(t), zc + rr * Math.sin(t)));
      }
      for (let i = 0; i <= n; i++) pts.push(P(x, cyR + ((cyL - cyR) * i) / n, zc - rr));
      for (let i = 1; i < n; i++) {
        const t = -Math.PI / 2 - (Math.PI * i) / n;
        pts.push(P(x, cyL + rr * Math.cos(t), zc + rr * Math.sin(t)));
      }
      return pts;
    };
    const o = stad(R.logR + 3.4);
    const i = stad(R.logR - 0.6);
    fills.push(poly(o, true));
    loops.push({ d: poly(o, true), k: "main" }, { d: poly(i, true), k: "fine" });
    // wraps across the rope
    for (let k = 0; k < 7; k++) {
      const y = -R.logY + 2 + k * ((2 * R.logY - 4) / 6);
      loops.push({ d: poly([P(x - 1.5, y - 2, zc + R.logR + 3.4), P(x + 1.5, y + 2, zc + R.logR - 0.6)]), k: "fine" });
    }
    // the knot
    loops.push({ d: poly(xy(I, x, 0, zc - R.logR - 1.4, 3.6, 0, Math.PI * 2, 14), true), k: "fine" });
    anchors.push(P(x, R.logY + R.logR + 2, zc));
  }
  const lashings: PartGeo = { fills, segs: loops, anchor: anchors[1]!, hit: fills.join("") };
  // ---- cleat
  const cz = 112;
  const cx = 0;
  const cy = -118;
  const plate = box(I, cx - 14, cx + 14, cy - 7, cy + 7, cz, cz + 4);
  const stem = box(I, cx - 4, cx + 4, cy - 4, cy + 4, cz + 4, cz + 12);
  const horn = box(I, cx - 20, cx + 20, cy - 4, cy + 4, cz + 12, cz + 18);
  const cleat: PartGeo = {
    fills: [plate.sil, stem.sil, horn.sil],
    segs: [...plate.faces, ...stem.faces, ...horn.faces].map((d) => ({ d, k: "main" as Kind })),
    anchor: P(cx + 20, cy - 4, cz + 15),
    hit: [plate.sil, stem.sil, horn.sil].join(""),
  };
  // ---- buoy (a sphere on an eye)
  const bz = 34;
  const by = -168;
  const br = 16;
  const bc = P(0, by, bz);
  const circ = (r: number, n = 36): V[] =>
    Array.from(
      { length: n + 1 },
      (_, i) =>
        [
          bc[0] + r * 1.2247 * Math.sin((i / n) * Math.PI * 2) * I.s,
          bc[1] - r * 1.2247 * Math.cos((i / n) * Math.PI * 2) * I.s,
        ] as V,
    );
  const eq = xy(I, 0, by, bz, br);
  const eq2 = xy(I, 0, by, bz + br * 0.55, br * 0.84);
  const eq3 = xy(I, 0, by, bz - br * 0.55, br * 0.84);
  const eye = xy(I, 0, by, bz + br + 3, 3.4);
  const buoy: PartGeo = {
    fills: [poly(circ(br), true)],
    segs: [
      { d: poly(circ(br), true), k: "main" },
      { d: poly(eq.slice(0, 19)), k: "fine" },
      { d: poly(eq2.slice(0, 19)), k: "fine" },
      { d: poly(eq3.slice(0, 19)), k: "fine" },
      { d: poly(eye, true), k: "main" },
      { d: poly([P(0, by, bz + br), P(0, by, bz + br + 3.4)]), k: "main" },
    ],
    anchor: P(0, by - br * 0.7, bz + br * 0.3),
    hit: poly(circ(br + 2), true),
  };
  // ---- sprout (the chart's own sprout, enlarged) at the top of the stack
  const sb = P(0, 0, R.zSprout);
  const k = I.s * 6.2;
  const tf = (px: number, py: number): V => [sb[0] + px * k, sb[1] + py * k];
  const L1 = [tf(0, -5.2), tf(0, -8.6), tf(-2.8, -10.4), tf(-6.2, -10.2), tf(-6.2, -6.8), tf(-3.6, -5), tf(0, -5.2)];
  const L2 = [tf(0, -6.6), tf(0, -9.4), tf(2.4, -11.2), tf(5.4, -11), tf(5.4, -8.2), tf(3, -6.4), tf(0, -6.6)];
  const cub = (p: V[]): string =>
    `M${f(p[0]![0])} ${f(p[0]![1])}C${f(p[1]![0])} ${f(p[1]![1])} ${f(p[2]![0])} ${f(p[2]![1])} ${f(p[3]![0])} ${f(p[3]![1])}C${f(p[4]![0])} ${f(p[4]![1])} ${f(p[5]![0])} ${f(p[5]![1])} ${f(p[6]![0])} ${f(p[6]![1])}Z`;
  const collar = xy(I, 0, 0, R.zSprout, 11);
  const collarTop = xy(I, 0, 0, R.zSprout + 7, 11);
  const sprout: PartGeo = {
    fills: [cub(L1), cub(L2)],
    segs: [
      { d: poly(collar, true), k: "main" },
      { d: poly([P(11, 0, R.zSprout), P(11, 0, R.zSprout + 7)]), k: "main" },
      { d: poly([P(-11, 0, R.zSprout), P(-11, 0, R.zSprout + 7)]), k: "main" },
      { d: poly(collarTop, true), k: "main" },
      { d: poly([P(0, 0, R.zSprout + 7), tf(0, -8.5)]), k: "acc" },
      { d: cub(L1), k: "acc" },
      { d: cub(L2), k: "acc" },
    ],
    anchor: tf(5.4, -10),
    hit: poly([tf(-7, -11.5), tf(6.5, -11.5), tf(6.5, 1), tf(-7, 1)], true),
  };
  // ---- exploded axes and connectors
  const axes: Seg[] = [
    { d: poly([P(0, 0, R.zSprout - 2), P(0, 0, R.zBoard + R.boardT)]), k: "center" },
    { d: poly([P(0, 0, R.zBoard), P(0, 0, 2 * R.logZ)]), k: "center" },
    { d: poly([P(0, 0, 2 * R.logZ + 2), P(0, 0, R.zLash + R.logZ + 24)]), k: "center" },
    // lashings up to their logs
    ...[-R.lashX, R.lashX].flatMap((x) =>
      [-R.logY, R.logY].map((y) => ({
        d: poly([P(x, y, R.zLash + R.logZ + R.logR + 3), P(x, y, 2 * R.logZ - 6)]),
        k: "dash" as Kind,
      })),
    ),
    // log centrelines
    { d: poly([P(-R.logLen / 2 - 14, -R.logY, R.logZ), P(R.logLen / 2 + 16, -R.logY, R.logZ)]), k: "center" },
    { d: poly([P(-R.logLen / 2 - 14, R.logY, R.logZ), P(R.logLen / 2 + 16, R.logY, R.logZ)]), k: "center" },
    // cleat and buoy to where they belong
    { d: poly([P(0, -118 + 8, 112), P(0, -R.boardL / 2, R.zBoard + R.boardT)]), k: "dash" },
    { d: poly([P(0, -168 + 22, 34), P(0, -R.logY - R.logR, R.logZ + 4)]), k: "dash" },
  ];
  return {
    lashings,
    buoy,
    logA,
    logB,
    cleat,
    boards,
    sprout,
    axes,
    tops: { logTop: P(0, 0, 2 * R.logZ), boardsTop: P(0, 0, R.zBoard + R.boardT), sproutBase: sb },
  };
}
