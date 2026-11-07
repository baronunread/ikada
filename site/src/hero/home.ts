/**
 * The homepage hero: Raft at dusk (./dusk) at the `raft` camera.
 *
 * First paint is the poster: the previous page's last frame when it handed the scene over for a box of this size,
 * else this camera's still (POSTER_SCRIPT in index.astro). The scene module loads after first paint (straight away
 * when a hand-off is waiting, else after `load` in idle time), mounts with the handed-over state, so its first frame
 * is the poster's picture, and glides to `raft`. On `pageswap` toward a page that shows the scene it stores the state
 * and the last frame for that page.
 *
 * ?backend=static keeps the poster (the no-WebGPU path).
 */
import { saveHandoff, takeHandoff, type Handoff } from "./dusk/handoff";
import type { Handle, Rect, Theme } from "./dusk/scene";

const html = document.documentElement;
const reduced = (): boolean =>
  html.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const theme = (): Theme => (html.dataset.theme === "light" ? "light" : "dark");

/** Protection strength per zone and theme (the shader mixes toward the page canvas by k inside the zone, soft
 *  outside). Measured with the contrast check: headline ≥ 3:1, lede and nav ≥ 4.5:1 on the worst pixel. */
const MASK_K = {
  light: { nav: 0.5, h1: 0.3, lede: 0.55, ctl: 0.35 },
  dark: { nav: 0.45, h1: 0.4, lede: 0.82, ctl: 0.35 },
} as const;

/** Pages that show the scene: anything on sproutboat.com outside /ikada, and this page. */
function showsScene(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return false;
    const p = u.pathname.replace(/\/index(\.html)?$/, "/");
    if (p === "/ikada" || p === "/ikada/") return true;
    return !p.startsWith("/ikada/");
  } catch {
    return false;
  }
}

export function bootHero(): void {
  const shell = document.querySelector<HTMLElement>("[data-hero-shell]");
  const media = shell?.querySelector<HTMLElement>("[data-hero-media]");
  const canvas = media?.querySelector<HTMLCanvasElement>("canvas");
  const poster = media?.querySelector<HTMLImageElement>("img");
  if (!shell || !media || !canvas || !poster) return;
  const forced = new URLSearchParams(location.search).get("backend");
  const handoff: Handoff | null = takeHandoff();
  let handle: Handle | null = null;
  let maskRaf = 0;

  const textBox = (el: Element): DOMRect => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return b.width ? b : el.getBoundingClientRect();
  };
  function rects(): Rect[] {
    const cr = canvas!.getBoundingClientRect();
    if (!cr.width || !cr.height) return [];
    const uv = (b: { left: number; top: number; right: number; bottom: number }, k: number, pad: number): Rect => ({
      x0: (b.left - pad - cr.left) / cr.width,
      y0: (b.top - pad - cr.top) / cr.height,
      x1: (b.right + pad - cr.left) / cr.width,
      y1: (b.bottom + pad - cr.top) / cr.height,
      k,
    });
    const K = MASK_K[theme()];
    const out: Rect[] = [];
    const nav = document.querySelector<HTMLElement>("[data-nav]");
    if (nav) out.push({ x0: -1, y0: -1, x1: 2, y1: (nav.offsetHeight * 0.9) / cr.height, k: K.nav });
    const h1 = shell!.querySelector("[data-hero-mask=h1]");
    const lede = shell!.querySelector("[data-hero-mask=lede]");
    const ctl = shell!.querySelector("[data-hero-mask=ctl]");
    if (h1) out.push(uv(textBox(h1), K.h1, 12));
    if (lede) out.push(uv(textBox(lede), K.lede, 12));
    if (ctl) out.push(uv(ctl.getBoundingClientRect(), K.ctl, 6));
    return out;
  }
  const remeasure = (animate = false): void => {
    cancelAnimationFrame(maskRaf);
    maskRaf = requestAnimationFrame(() => handle?.setMask(rects(), { animate }));
  };

  const posterFor = (t: Theme): string =>
    (poster.dataset.duskPoster ?? "").replace("{theme}", t).replace("{size}", innerWidth <= 600 ? "390" : "1440");

  async function boot(): Promise<void> {
    if (forced === "static") {
      shell!.dataset.backend = "static";
      return;
    }
    try {
      const { mount } = await import("./dusk/scene");
      handle = await mount(canvas!, {
        camera: "raft",
        theme: theme(),
        reduced: reduced(),
        host: shell!,
        state: handoff?.state,
        mask: rects(),
        // the canvas replaces the poster once it has drawn; after an exact hand-off it is the same picture
        onFirstFrame: () => requestAnimationFrame(() => canvas!.classList.add("on")),
      });
    } catch (e) {
      console.warn("[hero]", e);
      shell!.dataset.backend = "static";
      return;
    }
    shell!.dataset.backend = handle.backend;
    (window as Window & { __hero?: Handle }).__hero = handle;
    if (handle.backend !== "webgpu") return;
    document.fonts?.ready.then(() => remeasure(true));
  }

  addEventListener("resize", () => remeasure(), { passive: true });
  new MutationObserver(() => {
    if (shell.dataset.backend === "static" || !handle || handle.backend !== "webgpu") poster.src = posterFor(theme());
    handle?.setTheme(theme());
    handle?.setReduced(reduced());
    remeasure(true);
  }).observe(html, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => handle?.setReduced(reduced()));

  // hand-off out: only toward a page that shows the scene (the snapshot costs a re-render and an encode)
  let savedAt = 0;
  const save = (to?: string | null): void => {
    if (to !== undefined && !showsScene(to)) return;
    savedAt = performance.now();
    if (handle) saveHandoff(handle, canvas, theme());
    else if (handoff) sessionStorage.setItem("dusk:handoff", JSON.stringify({ ...handoff, at: Date.now() }));
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
