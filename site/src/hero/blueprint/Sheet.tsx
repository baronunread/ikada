import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { raftMarkerScale, raftScreenPx } from "../chart/cameras";
import { buildIso, makeIso, poly, R, type Kind, type PartGeo, type Seg, type V } from "./iso";
import { Live, META, type PartId } from "./live";

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

function layout(W: number, H: number, copyBottom?: number): Layout {
  const mobile = W < 701;
  const m = mobile ? 6 : 8;
  const navH = mobile ? 56 : 64;
  const title = mobile
    ? { w: W - 2 * (m + 14), h: 46, x: m + 14, y: H - m - 14 - 46 }
    : { w: 468, h: 96, x: W - m - 14 - 468, y: H - m - 14 - 96 };
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
}: {
  x: number;
  y: number;
  children: ReactNode;
  cls?: string;
  dl: number;
  anchor?: "start" | "middle" | "end";
  rot?: number;
}): ReactNode => (
  <text
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

// ------------------------------------------------------------------ the sheet
/** The blueprint of the raft: an exploded engineering drawing whose seven parts are real ikada components. `armed` runs the
 *  reveal (the paper opens from the raft marker, the ink draws on); closed, the sheet is invisible and inert. */
export function Sheet({
  w,
  h,
  armed,
  copyBottom,
}: {
  w: number;
  h: number;
  armed: boolean;
  copyBottom?: number;
}): ReactNode {
  const L = useMemo(() => layout(w, h, copyBottom), [w, h, copyBottom]);
  const { geo, mobile } = L;
  const [active, setActive] = useState<PartId | null>(null);
  const [pinned, setPinned] = useState(false);
  const closeT = useRef<number>(0);
  const openT = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastLab = useRef<PartId | null>(null);
  const kbd = useRef(false);

  const open = (id: PartId, pin = false): void => {
    clearTimeout(closeT.current);
    clearTimeout(openT.current);
    if (pin) {
      setActive(id);
      setPinned((p) => (active === id ? !p : true));
      return;
    }
    if (pinned) return;
    openT.current = window.setTimeout(() => setActive(id), active ? 0 : 90);
  };
  const leave = (): void => {
    clearTimeout(openT.current);
    if (pinned) return;
    clearTimeout(closeT.current);
    closeT.current = window.setTimeout(() => setActive(null), 260);
  };
  const close = (): void => {
    clearTimeout(closeT.current);
    clearTimeout(openT.current);
    setActive(null);
    setPinned(false);
  };
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
  const zoneX = (i: number): number => o2 + ((W - 2 * o2) * i) / L.zones.cols;
  const zoneY = (j: number): number => o2 + ((H - 2 * o2) * j) / L.zones.rows;
  const ticks: string[] = [];
  for (let i = 0; i <= L.zones.cols; i++) ticks.push(`M${zoneX(i)} ${o1}V${o2}M${zoneX(i)} ${H - o1}V${H - o2}`);
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
    <div ref={rootRef} className="art-a" data-active={active ?? undefined}>
      <div
        className="paper"
        style={sv({ "--rx": `${raftP.x}px`, "--ry": `${raftP.y}px`, "--gs": mobile ? "72px" : "96px" })}
      />
      <svg
        className="sheet"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
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
          <Ln d={`M${o1} ${o1}H${W - o1}V${H - o1}H${o1}Z`} k="fine" dl={B0 - 120} />
          <Ln d={`M${o2} ${o2}H${W - o2}V${H - o2}H${o2}Z`} k="main" dl={B0 - 100} />
          <Ln d={ticks.join("")} k="fine" dl={B0 - 60} />
          {Array.from({ length: L.zones.cols }, (_, i) => (
            <g key={i}>
              <Tx x={(zoneX(i) + zoneX(i + 1)) / 2} y={o1 + 7} anchor="middle" cls="zn" dl={B0 + 200}>
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
                tabIndex={-1}
                aria-hidden="true"
                onPointerEnter={() => open(id)}
                onPointerLeave={leave}
                onFocus={() => open(id, false)}
                onBlur={leave}
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
                onPointerEnter={() => open(lb.id)}
                onPointerLeave={leave}
                onFocus={() => open(lb.id)}
                onBlur={leave}
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
                  y={lb.y - (mobile ? 16 : 20)}
                  width={mobile ? 118 : 262}
                  height={mobile ? 32 : 40}
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
        <g className="tb">
          <Ln d={`M${T.x} ${T.y}H${T.x + T.w}V${T.y + T.h}H${T.x}Z`} k="main" dl={B0 + 700} />
          {!mobile && (
            <>
              <Ln
                d={`M${T.x} ${T.y + 30}H${T.x + T.w}M${T.x} ${T.y + 62}H${T.x + T.w}M${T.x + 196} ${T.y + 30}V${T.y + T.h}M${T.x + 290} ${T.y + 62}V${T.y + T.h}M${T.x + 424} ${T.y + 62}V${T.y + T.h}`}
                k="fine"
                dl={B0 + 760}
              />
              <Tx x={T.x + 12} y={T.y + 19} cls="tb-main" dl={B0 + 1500}>
                IKADA · SHEET 1 · REV 0.1.0
              </Tx>
              <Tx x={T.x + T.w - 12} y={T.y + 19} anchor="end" cls="tb-k" dl={B0 + 1520}>
                A3 · FIRST ANGLE
              </Tx>
              <Tx x={T.x + 12} y={T.y + 46} cls="tb-serif" dl={B0 + 1560}>
                The raft, exploded
              </Tx>
              <Tx x={T.x + 208} y={T.y + 46} cls="tb-v" dl={B0 + 1580}>
                Moored at Sprout Harbour
              </Tx>
              <Tx x={T.x + 12} y={T.y + 76} cls="tb-k" dl={B0 + 1600}>
                SHEET 1 OF 1
              </Tx>
              <Tx x={T.x + 208} y={T.y + 76} cls="tb-k" dl={B0 + 1620}>
                SCALE 1:1
              </Tx>
              <Tx x={T.x + 302} y={T.y + 76} cls="tb-k" dl={B0 + 1640}>
                DRAWN SPROUTBOAT
              </Tx>
              <Tx x={T.x + 436} y={T.y + 76} cls="tb-k" dl={B0 + 1660}>
                MIT
              </Tx>
            </>
          )}
          {mobile && (
            <>
              <Tx x={T.x + 12} y={T.y + 19} cls="tb-main" dl={B0 + 1500}>
                IKADA · SHEET 1 · REV 0.1.0
              </Tx>
              <Tx x={T.x + 12} y={T.y + 36} cls="tb-k" dl={B0 + 1560}>
                SCALE 1:1 · MIT · SPROUTBOAT
              </Tx>
            </>
          )}
        </g>
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

      {active && (
        <Callout
          key={active}
          id={active}
          autoFocus={kbd.current && pinned}
          label={activeLabel!}
          L={L}
          pinned={pinned}
          onEnter={() => {
            clearTimeout(closeT.current);
          }}
          onLeave={leave}
          onClose={close}
        />
      )}
    </div>
  );
}

function Callout({
  id,
  label,
  L,
  pinned,
  autoFocus,
  onEnter,
  onLeave,
  onClose,
}: {
  id: PartId;
  label: Label;
  L: Layout;
  pinned: boolean;
  autoFocus: boolean;
  onEnter(): void;
  onLeave(): void;
  onClose(): void;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const meta = META[id];
  const w = L.mobile ? L.W - 2 * (L.m + 8) : 304;
  const low = label.y > L.H * 0.56;
  const style: CSSProperties = L.mobile
    ? { left: L.m + 8, width: w, ...(low ? { top: 64 } : { bottom: L.m + 8 }) }
    : { width: w, left: L.W - L.m - 14 - w, top: Math.max(80, Math.min(label.y - 52, L.title.y - 214)) };
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="callout"
      style={style}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      role="dialog"
      aria-label={`${meta.comp}, live`}
      data-pinned={pinned || undefined}
    >
      <div className="co-head">
        <span className="co-n">{label.n}</span>
        <span className="co-name">{meta.comp}</span>
        <span className="co-pkg">@sproutboat/ikada</span>
        <button className="co-x" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="co-body">
        <Live id={id} />
      </div>
      <div className="co-foot">
        <code>{meta.snippet}</code>
      </div>
    </div>
  );
}
