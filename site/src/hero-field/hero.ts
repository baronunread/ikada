/**
 * The homepage hero's glue around the field (the Growth concept): loads it after `load` and in
 * idle time (never on the LCP path), feeds the text-protection mask, grows the field in over 2.4s
 * (the last 15% with scroll), plants a sprout where you press empty background, and follows the
 * page's theme and reduced-motion setting. ?backend=webgpu|webgl2|css forces a backend.
 *
 * The page needs: `[data-hero-shell]` with a `canvas[data-hero-canvas]`, and inside it the nav
 * band and the elements marked `data-hero-mask="h1|lede|ctl"`.
 */
import type { Handle, MaskRect } from "./load";

const html = document.documentElement;
const reduced = (): boolean =>
  html.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const theme = (): "light" | "dark" => (html.dataset.theme === "light" ? "light" : "dark");

/** Protection strength per zone and theme, from the mockup's measured contrast (src/contrast.mjs). */
const MASK_K = {
  light: { nav: 0.93, h1: 0.58, lede: 0.88, ctl: 0.45 },
  dark: { nav: 0.97, h1: 0.94, lede: 0.95, ctl: 0.55 },
} as const;
const MASK_PAD = 20;
/** Presses on these never plant: anything with meaning keeps its click. */
const NO_PLANT =
  "a, button, input, textarea, select, label, summary, [role=button], [tabindex], pre, code, [data-hero-mask=ctl], .nav, .drawer";

export function bootHero(): void {
  const shell = document.querySelector<HTMLElement>("[data-hero-shell]");
  const canvas = shell?.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
  if (!shell || !canvas) return;
  const forced = new URLSearchParams(location.search).get("backend");
  let handle: Handle | null = null;
  let grown = 0;
  let raf = 0;
  let maskRaf = 0;

  const textBox = (el: Element): DOMRect => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return b.width ? b : el.getBoundingClientRect();
  };
  function measureMask(): void {
    if (!handle || handle.backend === "css") return;
    const cr = canvas!.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const uv = (b: { left: number; top: number; right: number; bottom: number }, k: number, pad: number): MaskRect => ({
      x0: (b.left - pad - cr.left) / cr.width,
      y0: (b.top - pad - cr.top) / cr.height,
      x1: (b.right + pad - cr.left) / cr.width,
      y1: (b.bottom + pad - cr.top) / cr.height,
      k,
    });
    const K = MASK_K[theme()];
    const rects: MaskRect[] = [];
    const nav = document.querySelector<HTMLElement>("[data-nav]");
    if (nav) rects.push({ x0: -1, y0: -1, x1: 2, y1: (nav.offsetHeight * 1.1) / cr.height, k: K.nav });
    const h1 = shell!.querySelector("[data-hero-mask=h1]");
    const lede = shell!.querySelector("[data-hero-mask=lede]");
    if (h1) rects.push(uv(textBox(h1), K.h1, MASK_PAD));
    if (lede) rects.push(uv(textBox(lede), K.lede, MASK_PAD));
    const ctl = [...shell!.querySelectorAll("[data-hero-mask=ctl]")].map((el) => el.getBoundingClientRect());
    if (ctl.length)
      rects.push(
        uv(
          {
            left: Math.min(...ctl.map((r) => r.left)),
            top: Math.min(...ctl.map((r) => r.top)),
            right: Math.max(...ctl.map((r) => r.right)),
            bottom: Math.max(...ctl.map((r) => r.bottom)),
          },
          K.ctl,
          8,
        ),
      );
    handle.setMask(rects);
  }
  const remeasure = (): void => {
    cancelAnimationFrame(maskRaf);
    maskRaf = requestAnimationFrame(measureMask);
  };

  const ease = (k: number): number => 1 - Math.pow(1 - k, 3);
  const push = (): void => {
    if (!handle) return;
    const s = Math.min(1, scrollY / Math.max(1, shell.offsetHeight * 0.5));
    handle.setProgress(Math.min(1, grown + 0.15 * s));
  };
  function grow(): void {
    cancelAnimationFrame(raf);
    if (!handle) return;
    if (reduced()) {
      grown = 1;
      handle.setProgress(1);
      return;
    }
    grown = 0;
    const t0 = performance.now();
    const tick = (now: number): void => {
      const k = Math.min(1, (now - t0) / 2400);
      grown = 0.85 * ease(k);
      push();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  /* Planting: mouse and pen on pointer-down, touch on the tap's click so a scroll never plants. */
  const onText = (el: Element, x: number, y: number): boolean => {
    const t = el.closest("h1, h2, p");
    if (!t) return false;
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    const r = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      r.selectNodeContents(n);
      for (const b of r.getClientRects())
        if (x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 6 && y <= b.bottom + 6) return true;
    }
    return false;
  };
  const plantAt = (e: MouseEvent): void => {
    const h = handle as (Handle & { plant?: (u: number, v: number) => void }) | null;
    if (!h || h.backend === "css" || typeof h.plant !== "function") return;
    if (e.target instanceof Element && (e.target.closest(NO_PLANT) || onText(e.target, e.clientX, e.clientY))) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    const cr = canvas.getBoundingClientRect();
    const u = (e.clientX - cr.left) / cr.width;
    const v = (e.clientY - cr.top) / cr.height;
    if (u < 0 || u > 1 || v < 0 || v > 0.82) return;
    h.plant(u, v);
  };
  shell.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" && e.button === 0) plantAt(e);
  });
  shell.addEventListener("click", (e) => {
    if ((e as PointerEvent).pointerType === "touch") plantAt(e);
  });

  async function boot(): Promise<void> {
    if (forced === "css") {
      shell!.dataset.backend = "css";
      return;
    }
    try {
      const { mountHeroField } = await import("./load");
      handle = await mountHeroField(canvas!, {
        concept: "growth",
        theme: theme(),
        reduced: reduced(),
        host: shell!,
        backend: forced === "webgpu" || forced === "webgl2" ? forced : undefined,
      });
    } catch (e) {
      console.warn("[hero-field]", e);
      shell!.dataset.backend = "css";
      return;
    }
    shell!.dataset.backend = handle.backend;
    if (handle.backend === "css") return;
    measureMask();
    try {
      await handle.ready;
    } catch {}
    canvas!.classList.add("on");
    remeasure();
    setTimeout(remeasure, 900);
    grow();
    (window as Window & { __hero?: Handle }).__hero = handle;
  }

  addEventListener("resize", remeasure, { passive: true });
  addEventListener("scroll", push, { passive: true });
  document.fonts?.ready.then(remeasure);
  new MutationObserver(() => {
    handle?.setTheme(theme());
    handle?.setReduced(reduced());
    remeasure();
    grow();
  }).observe(html, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => handle?.setReduced(reduced()));

  const start = (): void => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => void boot(), { timeout: 1500 });
    else setTimeout(() => void boot(), 200);
  };
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
}
