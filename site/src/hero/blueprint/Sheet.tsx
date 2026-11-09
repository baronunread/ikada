import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { raftMarkerScale, raftScreenPx } from "../chart/cameras";
import { buildIso, makeIso, poly, R, type Kind, type PartGeo, type Seg, type V } from "./iso";
import { META, type PartId } from "./meta";

// the live components (Dialog, Select, Tabs ...) are a separate chunk: the sheet draws without them
const Live = lazy(() => import("./live").then((m) => ({ default: m.Live })));

/** one path per stroke kind: a few long pens instead of hundreds of short ones (the dash-draw repaints per element) */
const mergeSegs = (segs: Seg[]): Seg[] => {
  const by = new Map<Kind, string>();
  for (const s of segs) by.set(s.k, (by.get(s.k) ?? "") + s.d);
  return [...by].map(([k, d]) => ({ k, d }));
};
const sv = (o: Record<string, string | number>): CSSProperties => o as unknown as CSSProperties;

// ------------------------------------------------------------------ layout
interface Label {
  id: PartId;
  n: string;
  x: number;
  y: number;
  anchor: V;
}
interface Layout {
  W: number;
  H: number;
  mobile: boolean;
  m: number;
  /** the header's height: the frame starts below it */
  navH: number;
  geo: ReturnType<typeof buildIso>;
  order: PartId[];
  labels: Label[];
  labelX: number;
  title: { x: number; y: number; w: number; h: number };
  elev: { x: number; y: number; e: number } | null;
  dims: ReactNode[];
  zones: { cols: number; rows: number };
  raft: { x: number; y: number };
  kRaft: number;
  hint: V;
}

function layout(W: number, H: number, copyBottom?: number, navHeight?: number, tbW = TB_MIN_W): Layout {
  const mobile = W < 701;
  const m = mobile ? 6 : 8;
  const navH = navHeight ?? (mobile ? 56 : 60);
  const title = mobile
    ? { w: W - 2 * (m + 14), h: 46, x: m + 14, y: H - m - 14 - 46 }
    : { w: tbW, h: 96, x: W - m - 14 - tbW, y: H - m - 14 - 96 };
  // the drawing's box
  const top = mobile ? (copyBottom ? Math.max(300, copyBottom + 30) : 430) : navH + 34;
  const bottom = mobile ? title.y - 28 : title.y - 22;
  const availH = bottom - top;
  const boundsB = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  buildIso(makeIso(1, 0, 0, boundsB));
  const bw = boundsB.x1 - boundsB.x0;
  const bh = boundsB.y1 - boundsB.y0;
  const labelCol = mobile ? 112 : 252;
  const leftEdge = mobile ? m + 14 : Math.max(700, W * 0.5);
  const rightEdge = W - m - 14 - labelCol - (mobile ? 6 : 40);
  const s = Math.min(mobile ? 0.72 : 1.5, availH / bh, (rightEdge - leftEdge) / bw);
  const raft = raftScreenPx(W, H);
  // centre the drawing in its box; bias toward the raft's x on desktop
  const cxBox = (leftEdge + rightEdge) / 2;
  const ox = cxBox - ((boundsB.x0 + boundsB.x1) / 2) * s;
  const oy = top + (availH - bh * s) / 2 - boundsB.y0 * s;
  const I = makeIso(s, ox, oy);
  const geo = buildIso(I);
  // labels
  const parts: [PartId, PartGeo][] = [
    ["sprout", geo.sprout],
    ["boards", geo.boards],
    ["lashings", geo.lashings],
    ["logA", geo.logA],
    ["logB", geo.logB],
    ["cleat", geo.cleat],
    ["buoy", geo.buoy],
  ];
  const sorted = parts.slice().sort((a, b) => a[1].anchor[1] - b[1].anchor[1]);
  const labelX = W - m - 14 - labelCol;
  const gap = mobile ? 44 : 56;
  const ys = sorted.map((p) => p[1].anchor[1]);
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + gap);
  const over = ys[ys.length - 1]! - (bottom - 6);
  const lo = top + 4 - ys[0]!;
  const shift = over > 0 ? -Math.min(over, ys[0]! - (top + 4)) : lo > 0 ? lo : 0;
  const labels: Label[] = sorted.map((p, i) => ({
    id: p[0],
    n: String(i + 1).padStart(2, "0"),
    x: labelX,
    y: ys[i]! + shift,
    anchor: p[1].anchor,
  }));
  // elevations (desktop only)
  const pad0 = Math.min(72, Math.max(20, W * 0.05));
  const elev = mobile || W < 1100 || H < 760 ? null : { e: 1, x: pad0 + 34, y: H - 140 };
  return {
    W,
    H,
    mobile,
    m,
    navH,
    geo,
    order: sorted.map((p) => p[0]),
    labels,
    labelX,
    title,
    elev,
    dims: [],
    zones: { cols: mobile ? 4 : 8, rows: 5 },
    raft,
    kRaft: raftMarkerScale(W, H),
    hint: mobile ? [m + 14, title.y - 12] : [pad0, H - m - 14 - 20],
  };
}

// ------------------------------------------------------------------ small drawing helpers
const Ln = ({ d, k = "main", dl, i = 0 }: { d: string; k?: Kind; dl: number; i?: number }): ReactNode => (
  <path
    d={d}
    pathLength={1}
    className={`ln ${k} draw`}
    style={sv({ "--dl": `${Math.round((dl + i * 14) * 0.82)}ms`, "--dr": `${(i % 6) * 26}ms` })}
  />
);
const Pf = ({ d, dl }: { d: string; dl: number }): ReactNode => (
  <path d={d} className="pf" style={sv({ "--dl": `${Math.round((dl + 380) * 0.82)}ms` })} />
);
const Tx = ({
  x,
  y,
  children,
  cls = "",
  dl,
  anchor = "start",
  rot,
  tref,
}: {
  x: number;
  y: number;
  children: ReactNode;
  cls?: string;
  dl: number;
  anchor?: "start" | "middle" | "end";
  rot?: number;
  tref?: (el: SVGTextElement | null) => void;
}): ReactNode => (
  <text
    ref={tref}
    x={x}
    y={y}
    textAnchor={anchor}
    className={`tx ${cls}`}
    style={sv({ "--dl": `${Math.round(dl * 0.82)}ms` })}
    transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}
  >
    {children}
  </text>
);

function Dim({
  p,
  q,
  text,
  dl,
  flip = false,
  cls = "",
}: {
  p: V;
  q: V;
  text: string;
  dl: number;
  flip?: boolean;
  cls?: string;
}): ReactNode {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const ah = 7;
  const aw = 2.3;
  const arrow = (pt: V, sgn: number): string =>
    `M${pt[0]} ${pt[1]}L${pt[0] - sgn * ux * ah + nx * aw} ${pt[1] - sgn * uy * ah + ny * aw}L${pt[0] - sgn * ux * ah - nx * aw} ${pt[1] - sgn * uy * ah - ny * aw}Z`;
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mx = (p[0] + q[0]) / 2 + nx * (flip ? 9 : -9);
  const my = (p[1] + q[1]) / 2 + ny * (flip ? 9 : -9);
  return (
    <g className={`dim ${cls}`}>
      <Ln d={poly([p, q])} k="fine" dl={dl} />
      <path d={arrow(p, -1)} className="arr" style={sv({ "--dl": `${Math.round((dl + 300) * 0.82)}ms` })} />
      <path d={arrow(q, 1)} className="arr" style={sv({ "--dl": `${Math.round((dl + 300) * 0.82)}ms` })} />
      <Tx x={mx} y={my + 3} anchor="middle" cls="dimtx" dl={dl + 360} rot={ang}>
        {text}
      </Tx>
    </g>
  );
}

// ------------------------------------------------------------------ the title block
/** the narrowest the block is drawn; it grows when its text needs more */
const TB_MIN_W = 300;
/** padding inside every cell, left and right */
const TB_PAD = 12;
const TB_ROWS = [30, 62] as const;

/**
 * The title block is a grid whose cells size to their text: each text is measured (after the fonts load), each column is
 * its widest text plus padding on both sides, and the block is as wide as its rows need. Nothing touches or crosses a rule.
 */
function TitleBlock({
  T,
  mobile,
  version,
  B0,
  onNeed,
}: {
  T: Layout["title"];
  mobile: boolean;
  version: string;
  B0: number;
  onNeed(w: number): void;
}): ReactNode {
  const els = useRef<Record<string, SVGTextElement | null>>({});
  const [ws, setWs] = useState<Record<string, number>>({});
  const ref =
    (k: string) =>
    (el: SVGTextElement | null): void => {
      els.current[k] = el;
    };
  const w = (k: string): number => ws[k] ?? 0;
  const P = TB_PAD;
  const cA = Math.max(w("serif"), w("sheet")) + 2 * P;
  const cB = Math.max(w("scale"), 0) + 2 * P;
  const cC = w("drawn") + 2 * P;
  const cD = w("mit") + 2 * P;
  const need = Math.ceil(Math.max(TB_MIN_W, cA + cB + cC + cD, w("main") + w("a3") + 3 * P, cA + w("moored") + 2 * P));
  useLayoutEffect(() => {
    if (mobile) return undefined;
    let live = true;
    const measure = (): void => {
      if (!live) return;
      const next: Record<string, number> = {};
      for (const [k, el] of Object.entries(els.current)) if (el) next[k] = Math.ceil(el.getComputedTextLength()) + 1;
      setWs((p) => (Object.keys(next).every((k) => p[k] === next[k]) ? p : next));
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [mobile, version]);
  useEffect(() => {
    if (!mobile && ws.main) onNeed(need);
  }, [mobile, ws.main, need, onNeed]);
  const rev = `IKADA · SHEET 1 · REV ${version}`;
  if (mobile)
    return (
      <g className="tb">
        <rect
          x={T.x}
          y={T.y}
          width={T.w}
          height={T.h}
          className="tb-bg"
          style={sv({ "--dl": `${Math.round((B0 + 700) * 0.82)}ms` })}
        />
        <Ln d={`M${T.x} ${T.y}H${T.x + T.w}V${T.y + T.h}H${T.x}Z`} k="main" dl={B0 + 700} />
        <Tx x={T.x + P} y={T.y + 19} cls="tb-main" dl={B0 + 1500}>
          {rev}
        </Tx>
        <Tx x={T.x + P} y={T.y + 36} cls="tb-k" dl={B0 + 1560}>
          SCALE 1:1 · MIT · SPROUTBOAT
        </Tx>
      </g>
    );
  const x1 = T.x + cA;
  const x2 = x1 + cB;
  const x3 = x2 + cC;
  const [r1, r2] = TB_ROWS;
  const { x, y, w: tw, h } = T;
  return (
    <g className="tb">
      <rect
        x={x}
        y={y}
        width={tw}
        height={h}
        className="tb-bg"
        style={sv({ "--dl": `${Math.round((B0 + 700) * 0.82)}ms` })}
      />
      <Ln d={`M${x} ${y}H${x + tw}V${y + h}H${x}Z`} k="main" dl={B0 + 700} />
      <Ln
        d={`M${x} ${y + r1}H${x + tw}M${x} ${y + r2}H${x + tw}M${x1} ${y + r1}V${y + h}M${x2} ${y + r2}V${y + h}M${x3} ${y + r2}V${y + h}`}
        k="fine"
        dl={B0 + 760}
      />
      <Tx tref={ref("main")} x={x + P} y={y + 19} cls="tb-main" dl={B0 + 1500}>
        {rev}
      </Tx>
      <Tx tref={ref("a3")} x={x + tw - P} y={y + 19} anchor="end" cls="tb-k" dl={B0 + 1520}>
        A3 · FIRST ANGLE
      </Tx>
      <Tx tref={ref("serif")} x={x + P} y={y + 53} cls="tb-serif" dl={B0 + 1560}>
        The raft, exploded
      </Tx>
      <Tx tref={ref("moored")} x={x1 + P} y={y + 51} cls="tb-v" dl={B0 + 1580}>
        Moored at Sprout Harbour
      </Tx>
      <Tx tref={ref("sheet")} x={x + P} y={y + 82} cls="tb-k" dl={B0 + 1600}>
        SHEET 1 OF 1
      </Tx>
      <Tx tref={ref("scale")} x={x1 + P} y={y + 82} cls="tb-k" dl={B0 + 1620}>
        SCALE 1:1
      </Tx>
      <Tx tref={ref("drawn")} x={x2 + P} y={y + 82} cls="tb-k" dl={B0 + 1640}>
        DRAWN SPROUTBOAT
      </Tx>
      <Tx tref={ref("mit")} x={x3 + P} y={y + 82} cls="tb-k" dl={B0 + 1660}>
        MIT
      </Tx>
    </g>
  );
}

// ------------------------------------------------------------------ the sheet
/** The blueprint of the raft: an exploded engineering drawing whose seven parts are real ikada components. `armed` runs the
 *  reveal (the paper opens from the raft marker, the ink draws on); closed, the sheet is invisible and inert. */
export function Sheet({
  w,
  h,
  armed,
  copyBottom,
  navH,
  version,
}: {
  w: number;
  h: number;
  armed: boolean;
  copyBottom?: number;
  /** the header's height (the frame sits below it) */
  navH?: number;
  /** the package version: the title block's REV, the same string as the hero badge */
  version: string;
}): ReactNode {
  const [tbW, setTbW] = useState(TB_MIN_W);
  const L = useMemo(() => layout(w, h, copyBottom, navH, tbW), [w, h, copyBottom, navH, tbW]);
  const { geo, mobile } = L;
  const [active, setActive] = useState<PartId | null>(null);
  const [pinned, setPinned] = useState(false);
  const closeT = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const calloutEl = useRef<HTMLDivElement>(null);
  const lastLab = useRef<PartId | null>(null);
  const kbd = useRef(false);
  /** after Escape the pointer may be resting on a label: it must move before that opens anything again */
  const supp = useRef<{ x: number; y: number } | null>(null);
  const pt = useRef<{ x: number; y: number; px: number; py: number }>({ x: 0, y: 0, px: 0, py: 0 });

  // A part, its leader, its label and the callout are one hover zone (data-pid). Moving between zones switches at once:
  // there is no delay to open, no null state in between, and a short grace to cross a gap or travel to the callout.
  const cancelClose = (): void => clearTimeout(closeT.current);
  const hover = (id: PartId): void => {
    cancelClose();
    if (pinned || supp.current) return;
    setActive(id);
  };
  /** the pointer is heading for the callout: give it longer to arrive (a safe-triangle check, by direction) */
  const heading = (): boolean => {
    const c = calloutEl.current?.getBoundingClientRect();
    const { x, y, px, py } = pt.current;
    if (!c || (x === px && y === py)) return false;
    return (x - px) * ((c.left + c.right) / 2 - x) + (y - py) * ((c.top + c.bottom) / 2 - y) > 0;
  };
  /** the pointer is still over the drawing (its parts and labels, with some air): crossing the paper between two parts */
  const inDrawing = (): boolean => {
    const root = rootRef.current;
    if (!root) return false;
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    root.querySelectorAll(".part .hit, .lab rect").forEach((n) => {
      const r = n.getBoundingClientRect();
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    });
    const { x, y } = pt.current;
    return x > x0 - 28 && x < x1 + 28 && y > y0 - 28 && y < y1 + 28;
  };
  const graceClose = (): void => {
    if (pinned) return;
    cancelClose();
    // 120 ms on leaving the drawing; longer while crossing it between parts or heading for the callout
    const ms = heading() ? 360 : inDrawing() ? 420 : 120;
    closeT.current = window.setTimeout(() => setActive(null), ms);
  };
  const open = (id: PartId, pin = false): void => {
    cancelClose();
    setActive(id);
    if (pin) setPinned((p) => (active === id ? !p : true));
  };
  const close = (): void => {
    cancelClose();
    setActive(null);
    setPinned(false);
  };
  const pidOf = (t: EventTarget | null): PartId | null =>
    ((t as Element | null)?.closest?.("[data-pid]")?.getAttribute("data-pid") as PartId | null) ?? null;

  // one callout, mounted while any part is active: it glides between parts and crossfades its content; it enters only
  // when opening from nothing and leaves only when closing to nothing
  const [co, setCo] = useState<{ id: PartId | null; prev: PartId | null; mounted: boolean; on: boolean }>({
    id: null,
    prev: null,
    mounted: false,
    on: false,
  });
  const coT = useRef<number[]>([]);
  useEffect(() => {
    coT.current.forEach((t) => clearTimeout(t));
    coT.current = [];
    if (active) {
      setCo((c) => ({
        id: active,
        prev: c.mounted && c.id && c.id !== active ? c.id : null,
        mounted: true,
        on: c.mounted,
      }));
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setCo((c) => (c.on ? c : { ...c, on: true }))));
      coT.current.push(window.setTimeout(() => setCo((c) => ({ ...c, prev: null })), 140));
      return () => cancelAnimationFrame(r);
    }
    setCo((c) => ({ ...c, on: false }));
    coT.current.push(window.setTimeout(() => setCo({ id: null, prev: null, mounted: false, on: false }), 190));
    return undefined;
  }, [active]);
  useEffect(() => {
    if (!armed) close();
  }, [armed]);
  useEffect(() => {
    const st = rootRef.current?.closest(".bp");
    if (!st) return undefined;
    const down = (e: Event): void => {
      const t = e.target as HTMLElement;
      if (t.closest(".callout, .part, .lab")) return;
      close();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      // a Dialog, Select or menu opened from the callout takes the first Escape itself
      if (document.querySelector('[role="dialog"]:not(.callout), [role="listbox"], [role="menu"]')) return;
      const inside = !!document.activeElement?.closest(".callout");
      const id = lastLab.current;
      supp.current = { x: pt.current.x, y: pt.current.y };
      close();
      if (inside && id)
        requestAnimationFrame(() =>
          (rootRef.current?.querySelector(`.lab[data-id="${id}"]`) as SVGElement | null)?.focus(),
        );
    };
    st.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      st.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, []);

  const raftP = L.raft;
  const m = L.m;
  const { W, H } = L;
  const partGeo: Record<PartId, PartGeo> = {
    lashings: geo.lashings,
    buoy: geo.buoy,
    logA: geo.logA,
    logB: geo.logB,
    cleat: geo.cleat,
    boards: geo.boards,
    sprout: geo.sprout,
  };
  const paint: PartId[] = ["lashings", "buoy", "logA", "logB", "cleat", "boards", "sprout"];
  const B0 = 780; // ms after the click when the first stroke starts
  const labelOf = (id: PartId): Label => L.labels.find((l) => l.id === id)!;

  // ---- sheet furniture
  const o1 = m;
  const o2 = m + (mobile ? 9 : 14);
  // the frame's top edge sits under the header, which lives in the sheet's top margin like a drawing's border zone
  const t1 = Math.max(o1, L.navH);
  const t2 = t1 + (o2 - o1);
  const zoneX = (i: number): number => o2 + ((W - 2 * o2) * i) / L.zones.cols;
  const zoneY = (j: number): number => t2 + ((H - o2 - t2) * j) / L.zones.rows;
  const ticks: string[] = [];
  for (let i = 0; i <= L.zones.cols; i++) ticks.push(`M${zoneX(i)} ${t1}V${t2}M${zoneX(i)} ${H - o1}V${H - o2}`);
  for (let j = 0; j <= L.zones.rows; j++) ticks.push(`M${o1} ${zoneY(j)}H${o2}M${W - o1} ${zoneY(j)}H${W - o2}`);

  // ---- elevations
  const E = L.elev;
  const el: ReactNode[] = [];
  if (E) {
    const e = E.e;
    // side elevation: x horizontal; ground at E.y
    const gx = E.x;
    const gy = E.y;
    const X = (x: number): number => gx + (x + R.logLen / 2) * e;
    const Z = (z: number): number => gy - z * e;
    const rr = (x0: number, x1: number, z0: number, z1: number, r = 0): string => {
      const a = X(x0);
      const b = X(x1);
      const t = Z(z1);
      const u = Z(z0);
      const k = r * e;
      return k
        ? `M${a + k} ${t}H${b - k}A${k} ${k} 0 0 1 ${b} ${t + k}V${u - k}A${k} ${k} 0 0 1 ${b - k} ${u}H${a + k}A${k} ${k} 0 0 1 ${a} ${u - k}V${t + k}A${k} ${k} 0 0 1 ${a + k} ${t}Z`
        : `M${a} ${t}H${b}V${u}H${a}Z`;
    };
    const base = 1700;
    el.push(
      <g key="side" className="elev">
        <Ln d={rr(-R.logLen / 2, R.logLen / 2, 0, 2 * R.logZ, R.logR)} dl={base} />
        {[-R.pitch, 0, R.pitch].map((x, i) => (
          <Ln
            key={x}
            d={rr(x - R.boardW / 2, x + R.boardW / 2, 2 * R.logZ, 2 * R.logZ + R.boardT)}
            dl={base + 60 + i * 40}
          />
        ))}
        {[-R.lashX, R.lashX].map((x, i) => (
          <Ln key={x} d={rr(x - 2.6, x + 2.6, -3.4, 2 * R.logZ + 3.4, 2)} k="fine" dl={base + 100 + i * 40} />
        ))}
        <Ln
          d={poly(
            [
              [X(0), Z(2 * R.logZ + R.boardT)],
              [X(0), Z(2 * R.logZ + R.boardT + 8.5 * 6.2 * 0.5)],
            ],
            false,
          )}
          k="acc"
          dl={base + 220}
        />
        <Ln
          d={`M${X(0)} ${Z(2 * R.logZ + R.boardT + 4.3)}C${X(0) - 6 * e} ${Z(2 * R.logZ + R.boardT + 6)} ${X(0) - 18 * e} ${Z(2 * R.logZ + R.boardT + 9)} ${X(0) - 26 * e} ${Z(2 * R.logZ + R.boardT + 13)}`}
          k="accfine"
          dl={base + 260}
        />
        <Ln
          d={poly([
            [gx - 22, gy + 0.5],
            [gx + R.logLen * e + 22, gy + 0.5],
          ])}
          k="center"
          dl={base}
        />
        <Dim p={[X(-R.logLen / 2), gy + 22]} q={[X(R.logLen / 2), gy + 22]} text="200" dl={base + 300} flip />
        <Ln
          d={poly([
            [X(-R.logLen / 2), gy + 3],
            [X(-R.logLen / 2), gy + 26],
          ])}
          k="fine"
          dl={base + 300}
        />
        <Ln
          d={poly([
            [X(R.logLen / 2), gy + 3],
            [X(R.logLen / 2), gy + 26],
          ])}
          k="fine"
          dl={base + 300}
        />
        <Tx x={gx - 22} y={Z(2 * R.logZ + 30)} cls="cap" dl={base + 360}>
          SIDE ELEVATION
        </Tx>
      </g>,
    );
    // front elevation
    const fx = gx + R.logLen * e + 130;
    const Y = (y: number): number => fx + y * e;
    const circle = (cx: number, cz: number, r: number): string =>
      `M${Y(cx) - r * e} ${Z(cz)}a${r * e} ${r * e} 0 1 0 ${2 * r * e} 0a${r * e} ${r * e} 0 1 0 ${-2 * r * e} 0Z`;
    el.push(
      <g key="front" className="elev">
        <Ln d={circle(-R.logY, R.logZ, R.logR)} dl={base + 80} />
        <Ln d={circle(R.logY, R.logZ, R.logR)} dl={base + 120} />
        <Ln d={circle(-R.logY, R.logZ, R.logR * 0.45)} k="fine" dl={base + 160} />
        <Ln d={circle(R.logY, R.logZ, R.logR * 0.45)} k="fine" dl={base + 160} />
        <Ln
          d={`M${Y(-R.boardL / 2)} ${Z(2 * R.logZ)}H${Y(R.boardL / 2)}V${Z(2 * R.logZ + R.boardT)}H${Y(-R.boardL / 2)}Z`}
          dl={base + 200}
        />
        <Ln d={`M${Y(0)} ${Z(2 * R.logZ + R.boardT)}V${Z(2 * R.logZ + R.boardT + 26)}`} k="acc" dl={base + 260} />
        <Ln
          d={poly([
            [fx - 60 * e, gy + 0.5],
            [fx + 60 * e, gy + 0.5],
          ])}
          k="center"
          dl={base}
        />
        <Dim
          p={[Y(-R.logY - R.logR), gy + 22]}
          q={[Y(R.logY + R.logR), gy + 22]}
          text={String(2 * (R.logY + R.logR))}
          dl={base + 320}
          flip
        />
        <Ln
          d={poly([
            [Y(-R.logY - R.logR), Z(R.logZ) + 14],
            [Y(-R.logY - R.logR), gy + 26],
          ])}
          k="fine"
          dl={base + 320}
        />
        <Ln
          d={poly([
            [Y(R.logY + R.logR), Z(R.logZ) + 14],
            [Y(R.logY + R.logR), gy + 26],
          ])}
          k="fine"
          dl={base + 320}
        />
        <Tx x={Y(R.logY + R.logR) + 10} y={Z(R.logZ) + 3.5} cls="cap" dl={base + 340}>
          Ø34
        </Tx>
        <Tx x={fx} y={Z(2 * R.logZ + 36)} anchor="middle" cls="cap" dl={base + 380}>
          FRONT
        </Tx>
      </g>,
    );
  }

  const T = L.title;
  const hintX = L.hint[0];
  const hintY = L.hint[1];
  const activeLabel = active ? labelOf(active) : null;

  return (
    <div
      ref={rootRef}
      className="art-a"
      data-active={active ?? undefined}
      onPointerOver={(e) => {
        if (e.pointerType === "touch") return;
        const id = pidOf(e.target);
        if (id) hover(id);
        else graceClose();
      }}
      onPointerMove={(e) => {
        const p = pt.current;
        pt.current = { px: p.x, py: p.y, x: e.clientX, y: e.clientY };
        if (supp.current && Math.hypot(e.clientX - supp.current.x, e.clientY - supp.current.y) > 4) supp.current = null;
      }}
      onPointerLeave={graceClose}
    >
      <div
        className="paper"
        style={sv({ "--rx": `${raftP.x}px`, "--ry": `${raftP.y}px`, "--gs": mobile ? "72px" : "96px" })}
      />
      <svg
        className="sheet"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-roledescription="drawing"
        aria-label="Engineering drawing of the ikada raft, exploded, with seven parts that are ikada components."
        data-active={active ?? undefined}
      >
        <circle className="ring" cx={raftP.x} cy={raftP.y} r="0" />
        <g className="ghost" transform={`translate(${raftP.x} ${raftP.y}) rotate(-12.6) scale(${L.kRaft})`}>
          <circle r="18.9" className="g-ring" />
          <rect x="-10" y="-5.6" width="20" height="3.6" rx="1.8" className="g-log" />
          <rect x="-10" y="2" width="20" height="3.6" rx="1.8" className="g-log" />
          <path d="M-4.5-6.6V6.6M4.5-6.6V6.6" className="g-lash" />
          <path d="M0 .4V-8.5" className="g-sp" />
          <path
            d="M0-5.2C0-8.6-2.8-10.4-6.2-10.2-6.2-6.8-3.6-5-0-5.2ZM0-6.6C0-9.4 2.4-11.2 5.4-11 5.4-8.2 3-6.4 0-6.6Z"
            className="g-leaf"
          />
        </g>
        {/* neatline and zones */}
        <g className="furn">
          <Ln d={`M${o1} ${t1}H${W - o1}V${H - o1}H${o1}Z`} k="fine" dl={B0 - 120} />
          <Ln d={`M${o2} ${t2}H${W - o2}V${H - o2}H${o2}Z`} k="main" dl={B0 - 100} />
          <Ln d={ticks.join("")} k="fine" dl={B0 - 60} />
          {Array.from({ length: L.zones.cols }, (_, i) => (
            <g key={i}>
              <Tx x={(zoneX(i) + zoneX(i + 1)) / 2} y={t1 + 7} anchor="middle" cls="zn" dl={B0 + 200}>
                {i + 1}
              </Tx>
              <Tx x={(zoneX(i) + zoneX(i + 1)) / 2} y={H - o1 - 2.5} anchor="middle" cls="zn" dl={B0 + 200}>
                {i + 1}
              </Tx>
            </g>
          ))}
          {Array.from({ length: L.zones.rows }, (_, j) => (
            <g key={j}>
              <Tx x={o1 + 4.5} y={(zoneY(j) + zoneY(j + 1)) / 2 + 3} anchor="middle" cls="zn" dl={B0 + 200}>
                {"ABCDE"[j]}
              </Tx>
              <Tx x={W - o1 - 4.5} y={(zoneY(j) + zoneY(j + 1)) / 2 + 3} anchor="middle" cls="zn" dl={B0 + 200}>
                {"ABCDE"[j]}
              </Tx>
            </g>
          ))}
        </g>

        {/* the exploded raft */}
        <g className="iso">
          {mergeSegs(geo.axes).map((a: Seg, i: number) => (
            <Ln key={i} d={a.d} k={a.k} dl={B0 + 520 + i * 18} />
          ))}
          {paint.map((id, pi) => {
            const g = partGeo[id];
            const lab = labelOf(id);
            const dl = B0 + pi * 70;
            return (
              <g
                key={id}
                className="part"
                data-id={id}
                data-on={active === id || undefined}
                data-pid={id}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => open(id, true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(id, true);
                  }
                }}
              >
                {g.fills.map((d, i) => (
                  <Pf key={i} d={d} dl={dl} />
                ))}
                {mergeSegs(g.segs).map((sg, i) => (
                  <Ln key={i} d={sg.d} k={sg.k} dl={dl} i={i} />
                ))}
                <path d={g.hit} className="hit" />
              </g>
            );
          })}
        </g>

        {/* leaders and labels */}
        <g className="leaders">
          {L.labels.map((lb, i) => {
            const sx = lb.x - (mobile ? 18 : 34);
            const d = poly([lb.anchor, [sx, lb.y], [lb.x - 11, lb.y]]);
            return (
              <g key={lb.id} className="lead" data-id={lb.id} data-on={active === lb.id || undefined}>
                <Ln d={d} k="fine" dl={B0 + 1000 + i * 55} />
                <path d={d} className="leadhit" data-pid={lb.id} />
                <circle
                  cx={lb.anchor[0]}
                  cy={lb.anchor[1]}
                  r="2.2"
                  className="dot"
                  style={sv({ "--dl": `${Math.round((B0 + 1000 + i * 55) * 0.82)}ms` })}
                />
              </g>
            );
          })}
          {L.labels.map((lb, i) => {
            const meta = META[lb.id];
            const dl = B0 + 1100 + i * 55;
            return (
              <g
                key={lb.id}
                className="lab"
                data-id={lb.id}
                data-on={active === lb.id || undefined}
                tabIndex={armed ? 0 : -1}
                role="button"
                aria-label={`${lb.n} ${meta.comp}`}
                data-pid={lb.id}
                onFocus={() => hover(lb.id)}
                onBlur={(e) => {
                  if (!(e.relatedTarget as Element | null)?.closest?.(".callout, .lab")) graceClose();
                }}
                onClick={(e) => {
                  lastLab.current = lb.id;
                  kbd.current = e.detail === 0;
                  open(lb.id, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    lastLab.current = lb.id;
                    kbd.current = true;
                    open(lb.id, true);
                  }
                }}
              >
                <rect
                  x={lb.x - 14}
                  y={lb.y - (mobile ? 21 : 26)}
                  width={mobile ? 118 : 262}
                  height={mobile ? 42 : 52}
                  fill="transparent"
                />
                <circle
                  cx={lb.x}
                  cy={lb.y}
                  r={mobile ? 9 : 10.5}
                  className="bal"
                  style={sv({ "--dl": `${Math.round(dl * 0.82)}ms` })}
                />
                <Tx x={lb.x} y={lb.y + 3.4} anchor="middle" cls="balt" dl={dl + 120}>
                  {lb.n}
                </Tx>
                <Tx x={lb.x + (mobile ? 16 : 20)} y={lb.y + (mobile ? 3.6 : -1)} cls="name" dl={dl + 160}>
                  {meta.comp.toUpperCase()}
                </Tx>
                {!mobile && (
                  <Tx x={lb.x + 20} y={lb.y + 15} cls="note" dl={dl + 200}>
                    {meta.note}
                  </Tx>
                )}
              </g>
            );
          })}
        </g>

        {E && <g className="elevs">{el}</g>}

        {/* title block */}
        <TitleBlock T={T} mobile={mobile} version={version} B0={B0} onNeed={setTbW} />
        {mobile ? (
          <Tx x={hintX} y={hintY} cls="hint" dl={B0 + 1900}>
            Tap a part. It is the real component.
          </Tx>
        ) : (
          <g>
            <Tx x={hintX} y={hintY - 20} cls="tb-k" dl={B0 + 1900}>
              NOTES
            </Tx>
            <Tx x={hintX + 56} y={hintY - 20} cls="tb-k" dl={B0 + 1920}>
              1. EACH NUMBERED PART IS A COMPONENT OF @SPROUTBOAT/IKADA.
            </Tx>
            <Tx x={hintX + 56} y={hintY - 3} cls="hint" dl={B0 + 1940}>
              2. Hover a part. It is the real component, not a picture.
            </Tx>
          </g>
        )}
      </svg>

      {co.mounted && co.id && (
        <Callout
          elRef={calloutEl}
          id={co.id}
          prev={co.prev}
          on={co.on}
          autoFocus={kbd.current && pinned}
          label={labelOf(co.id)}
          L={L}
          pinned={pinned}
          onClose={close}
        />
      )}
    </div>
  );
}

function Callout({
  elRef,
  id,
  prev,
  on,
  label,
  L,
  pinned,
  autoFocus,
  onClose,
}: {
  elRef: RefObject<HTMLDivElement | null>;
  id: PartId;
  prev: PartId | null;
  on: boolean;
  label: Label;
  L: Layout;
  pinned: boolean;
  autoFocus: boolean;
  onClose(): void;
}): ReactNode {
  const [hgt, setHgt] = useState(0);
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setHgt(el.offsetHeight));
    ro.observe(el);
    setHgt(el.offsetHeight);
    return () => ro.disconnect();
  }, [elRef]);
  useEffect(() => {
    if (autoFocus) elRef.current?.focus();
  }, [autoFocus, elRef]);
  const meta = META[id];
  const w = L.mobile ? L.W - 2 * (L.m + 8) : 304;
  const low = label.y > L.H * 0.56;
  const x = L.mobile ? L.m + 8 : L.W - L.m - 14 - w;
  const y = L.mobile
    ? low
      ? L.navH + 18
      : L.H - L.m - 8 - hgt
    : Math.max(L.navH + 24, Math.min(label.y - 52, L.title.y - 214));
  const style: CSSProperties = { width: w, transform: `translate3d(${x}px, ${y}px, 0)` };
  const inner = (pid: PartId, lab: Label, live: boolean): ReactNode => (
    <>
      <div className="co-head">
        <span className="co-n">{lab.n}</span>
        <span className="co-name">{META[pid].comp}</span>
        <span className="co-pkg">@sproutboat/ikada</span>
        {live && (
          <button className="co-x" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>
      <div className="co-body">
        {live ? (
          <Suspense fallback={<div className="co-skel" aria-busy="true" />}>
            <Live id={pid} />
          </Suspense>
        ) : (
          <div className="co-skel" />
        )}
      </div>
      <div className="co-foot">
        <code>{META[pid].snippet}</code>
      </div>
    </>
  );
  return (
    <div
      ref={elRef}
      tabIndex={-1}
      className="callout"
      style={style}
      data-pid={id}
      data-on={on || undefined}
      role="dialog"
      aria-label={`${meta.comp}, live`}
      data-pinned={pinned || undefined}
    >
      <div className="co-stack">
        {prev && (
          <div key={"out-" + prev} className="co-layer out" aria-hidden="true">
            {inner(prev, L.labels.find((l) => l.id === prev) ?? label, false)}
          </div>
        )}
        <div key={id} className="co-layer in">
          {inner(id, label, true)}
        </div>
      </div>
    </div>
  );
}
