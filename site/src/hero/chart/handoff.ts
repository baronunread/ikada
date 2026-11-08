// The cross-page hand-off: the leaving page stores the chart's state and a snapshot of its last frame; the arriving
// page shows that snapshot as its first paint and mounts with the state, so the first live frame is the same picture
// and the camera then glides to the new page's preset. README.md, "Hand-off", has the recipe.
import type { Camera, ChartState, Handle, Theme } from "./scene";

export const HANDOFF_KEY = "chart:handoff";
/** older than this and the arriving page starts fresh */
export const HANDOFF_MAX_AGE_MS = 20000;

export interface Handoff {
  v: 1;
  at: number;
  /** the viewport and the chart box (CSS px) it was drawn for */
  w: number;
  h: number;
  cw: number;
  ch: number;
  /** the path of the page that stored it: a reload stores one too, and is not an arrival from elsewhere */
  from: string;
  theme: Theme;
  camera: Camera;
  state: ChartState;
  /** the last frame as a data URL (PNG: lossless, so the poster is the frame to the pixel; WebP when the PNG would
   *  not fit in sessionStorage), or null if it could not be read back */
  snap: string | null;
}

type HandoffWindow = Window & { __chartHandoff?: Handoff | null };

/** sessionStorage holds ~5M characters per origin; past this the snapshot falls back to WebP at quality 1 (lossless in Chrome, usually smaller than the PNG) */
const PNG_MAX_CHARS = 3_000_000;

/** Call on `pageswap` (and on `pagehide` as the fallback). Costs one re-render and a PNG encode: ~40 ms at 1440×900
 *  in Chrome on an M-series Mac (WebP would be ~85 ms and lossy). */
export function saveHandoff(handle: Handle, canvas: HTMLCanvasElement, theme: Theme): void {
  if (handle.backend !== "canvas") return;
  try {
    const r = canvas.getBoundingClientRect();
    const state = handle.getState();
    let snap = handle.snapshot("image/png");
    if (snap && snap.length > PNG_MAX_CHARS) snap = handle.snapshot("image/webp", 1);
    const h: Handoff = {
      v: 1,
      at: Date.now(),
      w: innerWidth,
      h: innerHeight,
      cw: r.width,
      ch: r.height,
      from: location.pathname,
      theme,
      camera: state.cam.to,
      state,
      snap,
    };
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
    } catch {
      // over quota: the state alone still carries the chart (no exact first paint)
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...h, snap: null }));
    }
  } catch {
    /* storage full or blocked: the next page starts fresh */
  }
}

/** The hand-off the head script accepted for this page (or null). */
export function takeHandoff(): Handoff | null {
  return (window as HandoffWindow).__chartHandoff ?? null;
}

/**
 * Classic inline script for <head>, after the page sets `html[data-theme]`. Reads and removes the stored hand-off, and
 * keeps it when it is fresh and drawn in the same theme: `window.__chartHandoff`.
 */
export const HEAD_SCRIPT = `(()=>{try{const k=${JSON.stringify(HANDOFF_KEY)},h=JSON.parse(sessionStorage.getItem(k)||"null");sessionStorage.removeItem(k);if(h&&h.v===1&&Date.now()-h.at<${HANDOFF_MAX_AGE_MS}&&h.theme===document.documentElement.dataset.theme)window.__chartHandoff=h}catch{}})();`;

/**
 * Classic inline script placed right after the poster `<img data-chart-poster="…{theme}…{size}…" decoding="sync">`
 * inside the chart's box. If the stored frame was drawn for a box of the same size, the poster shows it and the page
 * gets `html.chart-exact` (the canvas then appears without a fade: it is the same picture). Otherwise the poster is
 * the theme's still for this camera ({size}: 390 at ≤ 600 px wide, else 1440).
 */
export const POSTER_SCRIPT = `(()=>{const i=document.currentScript.previousElementSibling,h=window.__chartHandoff,t=document.documentElement.dataset.theme==="light"?"light":"dark";if(h&&h.snap){const r=i.parentElement.getBoundingClientRect();if(Math.abs(r.width-h.cw)<0.5&&Math.abs(r.height-h.ch)<0.5){i.src=h.snap;document.documentElement.classList.add("chart-exact");return}}i.src=i.dataset.chartPoster.replace("{theme}",t).replace("{size}",innerWidth<=600?"390":"1440")})();`;
