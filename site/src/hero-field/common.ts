// Shared runtime for both backends: DPR cap, fps cap, IntersectionObserver,
// visibilitychange, ResizeObserver, pointer smoothing, stats, reduced-motion
// single-frame mode and the Handle object the page talks to. Backends only
// implement `Renderer` (resize / draw / destroy).

export type Concept = 'caustics' | 'inkwash' | 'growth';
export type Backend = 'webgpu' | 'webgl2' | 'css';
export type Theme = 'light' | 'dark';

export interface Stats {
  backend: Backend; fps: number; cpuMs: number; gpuMs?: number; dpr: number; w: number; h: number;
}

/** A portable snapshot of the field, so a page can hand it to the next document (cross-document View Transition)
 *  without the field restarting. Plant ages are in seconds; retiring plants are dropped. */
export interface HeroState {
  time: number; progress: number; px: number; py: number; presence: number;
  plants: { u: number; v: number; age: number; vis: number }[];
}

export interface Opts {
  concept: Concept;
  theme: Theme;
  /** Render ONE static frame per state change, no loop. */
  reduced?: boolean;
  /** Element to listen for pointer moves on (defaults to canvas.parentElement). */
  host?: HTMLElement;
  /** Starting render scale cap. Default 1 everywhere (the field is soft); the runtime lowers it further, to 0.6,
   *  when the GPU stays over budget (see GPU_BUDGET_MS). */
  maxDpr?: number;
  /** Default 60 desktop, 30 when coarse pointer / <= 820. */
  maxFps?: number;
  /** Force a backend: 'webgl2' skips WebGPU detection, 'css' loads nothing. */
  backend?: Backend;
  /** Called ~1/s with frame statistics. */
  onStats?: (s: Stats) => void;
  /** Start from a snapshot taken with `getState()` (read once at mount): time, progress, pointer and plant ages carry over. */
  state?: HeroState;
  /** Lab hook: called synchronously right after each frame is submitted (never set in production). */
  onFrame?: () => void;
}

/** Protection rect in canvas uv (0..1, y down); k = protection strength 0..1 (1 = pure canvas colour). */
export interface MaskRect { x0: number; y0: number; x1: number; y1: number; k: number }
export const MASK_MAX = 4;

export interface Handle {
  backend: Backend;
  /** Resolves once the first frame has been presented. */
  ready: Promise<void>;
  setConcept(c: Concept): void;
  setTheme(t: Theme): void;
  setReduced(b: boolean): void;
  setProgress(p: number): void;
  /** Up to MASK_MAX soft protection rects (text, controls); the field fades to the canvas colour under them. */
  setMask(rects: MaskRect[]): void;
  /** Plant a sprout at (u, v) in canvas uv (y down). It branches out over ~1.8 s, then settles into the field.
   *  The last PLANT_MAX stay; the oldest fades out (0.4 s) when a new one needs its place. Under reduced motion it
   *  appears already settled, in one frame. No-op on the CSS backend. */
  plant(u: number, v: number): void;
  /** Snapshot of the current field state (see HeroState). */
  getState(): HeroState;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** Live sprouts kept in the ring; PLANT_SLOTS leaves room for the ones fading out. */
export const PLANT_MAX = 8, PLANT_SLOTS = 10;

export const CONCEPT_ID: Record<Concept, number> = { caustics: 0, inkwash: 1, growth: 2 };

/** Everything a backend needs to encode one frame. Pointer is in canvas uv (0..1, y down). */
export interface FrameState {
  w: number; h: number;
  time: number;
  mode: number;
  theme: Theme;
  progress: number;
  px: number; py: number;
  /** Pointer velocity from the follow spring, canvas uv per second (y down). Smooth by construction. */
  vx: number; vy: number;
  presence: number;
  /** PLANT_SLOTS × (u, v, age s, vis 0..1), live plants compacted to the front; the shader loops over plantN only. */
  plants: Float32Array;
  plantN: number;
  /** MASK_MAX × (x0, y0, x1, y1) in canvas uv; unused rects are zero-sized with k 0. */
  mask: Float32Array;
  /** MASK_MAX protection strengths. */
  maskK: Float32Array;
}

export interface Renderer {
  resize(w: number, h: number): void;
  draw(s: FrameState): void;
  /** Last measured GPU time in ms, when the backend has timer queries. */
  gpuMs?(): number | undefined;
  destroy(): void;
}

const isCoarse = () => matchMedia('(pointer: coarse)').matches || innerWidth <= 820;

/** A do-nothing handle for the CSS fallback (and for failures). */
export function cssHandle(): Handle {
  const noop = () => {};
  return { backend: 'css', ready: Promise.resolve(), setConcept: noop, setTheme: noop, setReduced: noop, setProgress: noop, setMask: noop, plant: noop, getState: emptyState, pause: noop, resume: noop, destroy: noop };
}
export const emptyState = (): HeroState => ({ time: 0, progress: 1, px: 0.5, py: 0.5, presence: 0, plants: [] });

export function createRuntime(canvas: HTMLCanvasElement, opts: Opts, backend: Backend, renderer: Renderer): Handle {
  const coarse = isCoarse();
  const maxDpr = opts.maxDpr ?? 1;
  const maxFps = opts.maxFps ?? (coarse ? 30 : 60);
  let dpr = Math.min(devicePixelRatio || 1, maxDpr);
  // Adaptive guard: 3 consecutive one-second windows over the GPU budget (or under 85% of the fps cap) → render scale × 0.8.
  const GPU_BUDGET_MS = coarse ? 4 : 5, MIN_SCALE = 0.6;
  let slow = 0;
  const host = opts.host ?? canvas.parentElement ?? canvas;

  const s: FrameState = {
    w: 0, h: 0, time: 0, mode: CONCEPT_ID[opts.concept], theme: opts.theme,
    progress: opts.concept === 'growth' ? 0 : 1, px: 0.5, py: 0.5, vx: 0, vy: 0, presence: 0,
    plants: new Float32Array(PLANT_SLOTS * 4).fill(-1), plantN: 0,
    mask: new Float32Array(MASK_MAX * 4), maskK: new Float32Array(MASK_MAX),
  };
  let reduced = !!opts.reduced;
  let paused = false, visible = true, destroyed = false;
  let tx = 0.5, ty = 0.5, tPresence = 0;          // pointer targets
  let rafId = 0, oneId = 0, last = 0;
  let frames = 0, cpuAcc = 0, statAt = 0, drawn = false;

  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });

  const shouldRun = () => !destroyed && !paused && visible && !document.hidden && !reduced;

  function drawOnce() {
    if (destroyed || s.w === 0 || s.h === 0) return;
    const t0 = performance.now();
    renderer.draw(s);
    cpuAcc += performance.now() - t0;
    frames++;
    opts.onFrame?.();
    if (!drawn) { drawn = true; requestAnimationFrame(() => resolveReady()); }
  }

  /** Reduced motion / off-loop: coalesce state changes into one frame. */
  function requestOne() {
    if (oneId || destroyed) return;
    oneId = requestAnimationFrame(() => { oneId = 0; drawOnce(); });
  }

  function schedule() {
    if (!rafId && shouldRun()) rafId = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    rafId = 0;
    if (!shouldRun()) return;
    const minDt = 1000 / maxFps;
    if (now - last < minDt - 2) { schedule(); return; }       // fps cap: skip this rAF tick
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    last = now;
    stepPointer(dt);
    stepPlants(now);
    s.time = (s.time + dt) % 3600;                             // keep f32 precision in the shader
    drawOnce();
    if (now - statAt >= 1000) {
      if (statAt) {
        const fps = Math.round((frames * 1000) / (now - statAt)), gpuMs = renderer.gpuMs?.();
        opts.onStats?.({ backend, fps, cpuMs: +(cpuAcc / Math.max(1, frames)).toFixed(3), gpuMs, dpr: +dpr.toFixed(2), w: s.w, h: s.h });
        slow = (gpuMs != null && gpuMs > GPU_BUDGET_MS) || fps < maxFps * 0.85 ? slow + 1 : 0;
        if (slow >= 3 && dpr > MIN_SCALE) { slow = 0; dpr = Math.max(MIN_SCALE, dpr * 0.8); const r = canvas.getBoundingClientRect(); resize(r.width, r.height); }
      }
      statAt = now; frames = 0; cpuAcc = 0;
    }
    schedule();
  }

  // Pointer follow: two independent critically damped springs (apple-design §3/§4: X and Y separately, damping 1,
  // response ~0.45 s, so the field trails the cursor and a reversal carries its velocity instead of hard-cutting).
  // The spring's own velocity is what the shader reads, so there is no per-event jitter to filter.
  const OMEGA = (2 * Math.PI) / 0.45, VMAX = 3;
  function stepPointer(dt: number) {
    let left = dt;
    while (left > 1e-6) {                                       // ≤ 8 ms substeps keep the integrator stable at 30 fps
      const h = Math.min(left, 0.008);
      s.vx += (OMEGA * OMEGA * (tx - s.px) - 2 * OMEGA * s.vx) * h;
      s.vy += (OMEGA * OMEGA * (ty - s.py) - 2 * OMEGA * s.vy) * h;
      s.px += s.vx * h; s.py += s.vy * h;
      left -= h;
    }
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > VMAX) { s.vx *= VMAX / sp; s.vy *= VMAX / sp; }
    // Presence: in quickly (~0.15 s), out slowly (~0.6 s) so leaving the hero never snaps the field back.
    const kp = 1 - Math.exp(-dt / (tPresence > s.presence ? 0.15 : 0.6));
    s.presence += (tPresence - s.presence) * kp;
  }

  // Plants: a ring of the last PLANT_MAX. Ages are computed here so the shader only reads them; the oldest live plant
  // retires with a 0.4 s fade when a new one needs room, so nothing pops.
  // NaN marks "empty" / "not retiring": a birth time can legitimately be negative (a plant adopted from the previous
  // document, or a settled plant under reduced motion, is older than this page's performance.now()).
  const plantBorn = new Float64Array(PLANT_SLOTS).fill(NaN);   // performance.now() at planting, NaN = empty slot
  const plantRetire = new Float64Array(PLANT_SLOTS).fill(NaN); // performance.now() when retiring began, NaN = live
  const used = (i: number) => !Number.isNaN(plantBorn[i]), retiring = (i: number) => !Number.isNaN(plantRetire[i]);
  const plantU = new Float32Array(PLANT_SLOTS), plantV = new Float32Array(PLANT_SLOTS);
  const SETTLED_AGE = 6, RETIRE_MS = 400;
  function stepPlants(now: number) {
    let n = 0;
    for (let i = 0; i < PLANT_SLOTS; i++) {
      if (!used(i)) continue;
      let vis = 1;
      if (retiring(i)) {
        vis = 1 - (now - plantRetire[i]) / RETIRE_MS;
        if (vis <= 0 || reduced) { plantBorn[i] = NaN; plantRetire[i] = NaN; continue; }
      }
      const o = n++ * 4;
      s.plants[o] = plantU[i]; s.plants[o + 1] = plantV[i];
      s.plants[o + 2] = reduced ? SETTLED_AGE : Math.min(600, (now - plantBorn[i]) / 1000);
      s.plants[o + 3] = vis;
    }
    s.plantN = n;
    s.plants.fill(-1, n * 4);
  }
  function plant(u: number, v: number) {
    if (destroyed || !(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return;
    const now = performance.now();
    const live: number[] = [];
    for (let i = 0; i < PLANT_SLOTS; i++) if (used(i) && !retiring(i)) live.push(i);
    if (live.length >= PLANT_MAX) {
      const oldest = live.reduce((a, b) => (plantBorn[a] <= plantBorn[b] ? a : b));
      if (reduced) plantBorn[oldest] = NaN; else plantRetire[oldest] = now;
    }
    let slot = -1;
    for (let i = 0; i < PLANT_SLOTS; i++) if (!used(i)) { slot = i; break; }
    if (slot < 0) {                                              // every spare is still fading: take the most faded one
      let best = -1, bestT = Infinity;
      for (let i = 0; i < PLANT_SLOTS; i++) if (retiring(i) && plantRetire[i] < bestT) { bestT = plantRetire[i]; best = i; }
      slot = best;
    }
    if (slot < 0) return;
    plantBorn[slot] = reduced ? now - SETTLED_AGE * 1000 : now; plantRetire[slot] = NaN;
    plantU[slot] = u; plantV[slot] = v;
    stepPlants(now);
    if (!shouldRun()) requestOne();
  }

  function resize(cw: number, ch: number) {
    const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
    if (w === s.w && h === s.h) return;
    s.w = w; s.h = h;
    canvas.width = w; canvas.height = h;
    renderer.resize(w, h);
    if (!shouldRun()) requestOne();
  }

  // Observers and listeners -------------------------------------------------
  const ro = new ResizeObserver((entries) => {
    const r = entries[0].contentRect;
    resize(r.width, r.height);
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) { last = 0; schedule(); }
  });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) { last = 0; schedule(); } };
  document.addEventListener('visibilitychange', onVis);

  const aim = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    tx = (e.clientX - r.left) / r.width;
    ty = (e.clientY - r.top) / r.height;
    return true;
  };
  // Reduced motion: no pointer-driven motion at all (the targets still update so a later switch starts in place).
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;                    // touch moves are scrolls; no hover dependence
    if (aim(e) && !reduced) tPresence = 1;
  };
  const onDown = (e: PointerEvent) => {
    if (!aim(e) || reduced) return;
    if (e.pointerType === 'touch') { s.px = tx; s.py = ty; s.vx = s.vy = 0; } // a tap is a jump, not a flight
    tPresence = 1;
  };
  const onUp = (e: PointerEvent) => { if (e.pointerType === 'touch') tPresence = 0; };
  const onLeave = () => { tPresence = 0; };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  host.addEventListener('pointerup', onUp, { passive: true });
  host.addEventListener('pointercancel', onLeave, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });

  // Adopt a snapshot from the previous document, if any.
  const st = opts.state;
  if (st) {
    const fin = (x: unknown, dflt: number) => (typeof x === 'number' && Number.isFinite(x) ? x : dflt);
    s.time = fin(st.time, 0) % 3600;
    s.progress = Math.min(1, Math.max(0, fin(st.progress, s.progress)));
    s.px = tx = fin(st.px, 0.5); s.py = ty = fin(st.py, 0.5);
    s.presence = Math.min(1, Math.max(0, fin(st.presence, 0)));
    const now = performance.now();
    (st.plants ?? []).filter((p) => p && fin(p.vis, 1) > 0).slice(-PLANT_MAX).forEach((p, i) => {
      plantBorn[i] = now - Math.max(0, fin(p.age, SETTLED_AGE)) * 1000; plantRetire[i] = NaN;
      plantU[i] = fin(p.u, 0.5); plantV[i] = fin(p.v, 0.5);
    });
    stepPlants(now);
  }

  // First frame as soon as possible so `ready` settles within a frame or two.
  const rect = canvas.getBoundingClientRect();
  resize(rect.width, rect.height);
  if (s.w && s.h) requestOne();
  schedule();

  return {
    backend,
    ready,
    setConcept(c) { s.mode = CONCEPT_ID[c]; if (!shouldRun()) requestOne(); },
    setTheme(t) { s.theme = t; if (!shouldRun()) requestOne(); },
    setReduced(b) {
      reduced = b;
      if (b) { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } s.presence = 0; tPresence = 0; s.vx = s.vy = 0; stepPlants(performance.now()); requestOne(); }
      else { last = 0; schedule(); }
    },
    setProgress(p) { s.progress = Math.min(1, Math.max(0, p)); if (!shouldRun()) requestOne(); },
    setMask(rects) {
      s.mask.fill(0); s.maskK.fill(0);
      for (let i = 0; i < Math.min(MASK_MAX, rects.length); i++) {
        const r = rects[i];
        s.mask.set([r.x0, r.y0, r.x1, r.y1], i * 4);
        s.maskK[i] = Math.min(1, Math.max(0, r.k));
      }
      if (!shouldRun()) requestOne();
    },
    plant,
    getState() {
      const now = performance.now(), plants: HeroState['plants'] = [];
      const order = [...Array(PLANT_SLOTS).keys()].filter((i) => used(i) && !retiring(i)).sort((a, b) => plantBorn[a] - plantBorn[b]);
      for (const i of order) plants.push({ u: plantU[i], v: plantV[i], age: reduced ? SETTLED_AGE : (now - plantBorn[i]) / 1000, vis: 1 });
      return { time: s.time, progress: s.progress, px: s.px, py: s.py, presence: s.presence, plants };
    },
    pause() { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } },
    resume() { paused = false; last = 0; schedule(); },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (oneId) cancelAnimationFrame(oneId);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onLeave);
      renderer.destroy();
      resolveReady();
    },
  };
}
