/**
 * The homepage hero: the nautical chart (./chart) at the `raft` camera.
 *
 * First paint is the poster: the previous page's last frame when it handed the chart over for a box of this size,
 * else this camera's still (POSTER_SCRIPT in index.astro). The chart module loads after first paint (straight away
 * when a hand-off is waiting, else after `load` in idle time), mounts with the handed-over state, so its first frame
 * is the poster's picture, and glides to `raft`. On `pageswap` toward a page that shows the chart it stores the state
 * and the last frame for that page; a click on a link there starts the camera toward that page's preset at once.
 *
 * ?backend=static keeps the poster. ?chart=freeze draws the first frame and stops (the poster generator uses it).
 */
import { saveHandoff, takeHandoff, type Handoff } from "./chart/handoff";
import type { Camera, Handle, Mask, Theme } from "./chart/scene";

const html = document.documentElement;
const reduced = (): boolean =>
  html.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const theme = (): Theme => (html.dataset.theme === "light" ? "light" : "dark");

/** The camera of the page a link leads to, or null when that page does not show the chart. */
function cameraFor(url: string | undefined | null): Camera | null {
  if (!url) return null;
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return null;
    const p = u.pathname.replace(/\/index(\.html)?$/, "/");
    if (p === "/ikada" || p === "/ikada/") return "raft";
    if (p === "/") return "wide";
    return null;
  } catch {
    return null;
  }
}

export function bootHero(): void {
  const shell = document.querySelector<HTMLElement>("[data-hero-shell]");
  const media = shell?.querySelector<HTMLElement>("[data-hero-media]");
  const markers = shell?.querySelector<HTMLElement>("[data-hero-markers]");
  const canvas = media?.querySelector<HTMLCanvasElement>("canvas");
  const poster = media?.querySelector<HTMLImageElement>("img");
  if (!shell || !media || !canvas || !poster || !markers) return;
  const q = new URLSearchParams(location.search);
  const handoff: Handoff | null = takeHandoff();
  let handle: Handle | null = null;
  let maskRaf = 0;

  const textBox = (el: Element): DOMRect => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return b.width ? b : el.getBoundingClientRect();
  };
  /** the union of the pill, headline, lede and actions, in the canvas's own px, and the header's height */
  function mask(): Mask {
    const cr = canvas!.getBoundingClientRect();
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    shell!.querySelectorAll("[data-hero-mask]").forEach((el) => {
      const b =
        el.getAttribute("data-hero-mask") === "ctl" || el.getAttribute("data-hero-mask") === "pill"
          ? el.getBoundingClientRect()
          : textBox(el);
      if (!b.width) return;
      x0 = Math.min(x0, b.left);
      y0 = Math.min(y0, b.top);
      x1 = Math.max(x1, b.right);
      y1 = Math.max(y1, b.bottom);
    });
    const nav = document.querySelector<HTMLElement>("[data-nav]");
    return {
      copy: x1 > x0 ? { x0: x0 - cr.left, y0: y0 - cr.top, x1: x1 - cr.left, y1: y1 - cr.top } : null,
      navH: nav ? nav.offsetHeight : 0,
    };
  }
  const remeasure = (animate = false): void => {
    cancelAnimationFrame(maskRaf);
    maskRaf = requestAnimationFrame(() => handle?.setMask(mask(), { animate }));
  };

  const posterFor = (t: Theme): string =>
    (poster.dataset.chartPoster ?? "").replace("{theme}", t).replace("{size}", innerWidth <= 600 ? "390" : "1440");

  async function boot(): Promise<void> {
    if (q.get("backend") === "static") {
      shell!.dataset.backend = "static";
      return;
    }
    try {
      const { mount } = await import("./chart/scene");
      handle = await mount(canvas!, {
        camera: "raft",
        theme: theme(),
        reduced: reduced(),
        host: shell!,
        markers: markers!,
        state: handoff?.state,
        mask: mask(),
        words: { caption: "ikada · the raft, moored at Sprout Harbour · simulated values illustrative" },
        // the canvas replaces the poster once it has drawn; after an exact hand-off it is the same picture
        onFirstFrame: () => {
          if (q.get("chart") === "debug")
            (window as Window & { __firstFrame?: string }).__firstFrame = canvas!.toDataURL("image/png");
          requestAnimationFrame(() => canvas!.classList.add("on"));
        },
      });
    } catch (e) {
      console.warn("[hero]", e);
      shell!.dataset.backend = "static";
      return;
    }
    shell!.dataset.backend = handle.backend;
    (window as Window & { __hero?: Handle }).__hero = handle;
    if (handle.backend !== "canvas") return;
    if (q.get("chart") === "freeze") handle.pause();
    document.fonts?.ready.then(() => remeasure(q.get("chart") !== "freeze"));
  }

  addEventListener("resize", () => remeasure(), { passive: true });
  new MutationObserver(() => {
    if (shell.dataset.backend === "static" || !handle || handle.backend !== "canvas") poster.src = posterFor(theme());
    handle?.setTheme(theme());
    handle?.setReduced(reduced());
    remeasure(true);
  }).observe(html, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => handle?.setReduced(reduced()));

  // a click on a link to the other page starts the camera toward its preset now; the glide runs while it loads
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== "_self")) return;
    const cam = cameraFor(a.href);
    if (cam && cam !== "raft") handle?.setCamera(cam);
  });

  // hand-off out: only toward a page that shows the chart (the snapshot costs a re-render and an encode)
  let savedAt = 0;
  const save = (to?: string | null): void => {
    if (to !== undefined && !cameraFor(to)) return;
    savedAt = performance.now();
    if (handle) saveHandoff(handle, canvas, theme());
    else if (handoff) sessionStorage.setItem("chart:handoff", JSON.stringify({ ...handoff, at: Date.now() }));
  };
  addEventListener("pageswap", (e) => save((e as PageSwapEvent).activation?.entry?.url ?? null));
  addEventListener("pagehide", () => {
    if (performance.now() - savedAt > 1000) save();
  });
  addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) handle?.resume();
  });

  // after first paint: straight away when a hand-off is waiting (the poster is its last frame), else in idle time
  if (handoff) requestAnimationFrame(() => setTimeout(() => void boot(), 0));
  else {
    const start = (): void => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => void boot(), { timeout: 1500 });
      else setTimeout(() => void boot(), 200);
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
  }
}
