/**
 * The docs chrome in the browser, no framework: theme switch, header strip on scroll, the mobile
 * drawer, copy buttons, the TOC highlight, segmented radios (roving tabindex), install tabs, block
 * stages and the search palette (loaded on first use).
 */
import { wireAll } from "../components/ikada-mark-motion";

const root = document.documentElement;
/** Polite announcement for screen readers ("Copied"). */
function announce(text: string): void {
  const el = document.querySelector<HTMLElement>("[data-announce]");
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => (el.textContent = text));
}

/** A theme change is a cut: no transition smears across the page for one frame. */
export function setTheme(next: "light" | "dark", scope: HTMLElement = root): void {
  root.classList.add("no-transitions");
  scope.dataset.theme = next;
  scope.classList.toggle("dark", next === "dark");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-transitions")));
}

function themeToggle(): void {
  const sync = (): void => {
    const light = root.dataset.theme === "light";
    document
      .querySelectorAll("[data-theme-toggle]")
      .forEach((b) => b.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme"));
  };
  sync();
  document.addEventListener("click", (e) => {
    const b = (e.target as Element | null)?.closest("[data-theme-toggle]");
    if (!b) return;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("ikada-theme", next);
    sync();
  });
}

/**
 * Several demos on one page often render the same landmark (four Sidebars, four Paginations) and
 * landmarks need unique names. Suffix each demo's landmark label with the demo's title. This runs
 * here, not in a React effect, because demo islands hydrate lazily and the SSR markup must be right too.
 */
function distinctLandmarks(): void {
  const used = new Map<string, number>();
  const label = (scope: Element, title: string): void => {
    scope
      .querySelectorAll<HTMLElement>('nav[aria-label], aside, section[aria-label], [role="region"][aria-label]')
      .forEach((el) => {
        if (el.dataset.demoLabel) return;
        el.dataset.demoLabel = "1";
        const base = el.getAttribute("aria-label") ?? (el.tagName === "ASIDE" ? "Complementary" : "Region");
        const wanted = `${base} (${title} demo)`;
        const n = (used.get(wanted) ?? 0) + 1;
        used.set(wanted, n);
        el.setAttribute("aria-label", n > 1 ? `${wanted} ${n}` : wanted);
      });
  };
  const run = (): void => {
    document.querySelectorAll<HTMLElement>(".stage").forEach((stage) => {
      const heading = stage.querySelector("h2, h3")?.textContent?.trim() ?? "example";
      const preview = stage.querySelector(".stage-preview");
      if (preview) label(preview, heading);
    });
    document
      .querySelectorAll<HTMLElement>("[data-block-ready]")
      .forEach((el) => label(el, `${el.dataset.blockReady} block`));
  };
  run();
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
}

function scrolled(): void {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;
  const on = (): void => void nav.toggleAttribute("data-scrolled", scrollY > 4);
  on();
  addEventListener("scroll", on, { passive: true });
}

function drawer(): void {
  const burger = document.querySelector<HTMLButtonElement>("[data-burger]");
  const panel = document.querySelector<HTMLElement>("[data-drawer]");
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!burger || !panel) return;
  const set = (open: boolean, focusBack = false): void => {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Menu");
    panel.toggleAttribute("data-open", open);
    nav?.toggleAttribute("data-open", open);
    root.style.overflow = open ? "hidden" : "";
    if (open) panel.querySelector<HTMLElement>("[aria-current], a")?.focus({ preventScroll: true });
    else if (focusBack) burger.focus();
    if (open) panel.querySelector("[aria-current]")?.scrollIntoView({ block: "center" });
  };
  burger.addEventListener("click", () => set(burger.getAttribute("aria-expanded") !== "true"));
  panel.addEventListener("click", (e) => {
    if ((e.target as Element).closest("a")) set(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.hasAttribute("data-open")) set(false, true);
  });
  matchMedia("(min-width: 861px)").addEventListener("change", (m) => m.matches && set(false));
}

/** The text a copy button copies: `data-copy` itself, or the text of the element `data-copy-from` names. */
function copyText(b: HTMLElement): string {
  if (b.dataset.copy != null) return b.dataset.copy;
  const sel = b.dataset.copyFrom;
  const src = sel ? document.querySelector<HTMLElement>(sel) : null;
  if (!src) return "";
  if (src instanceof HTMLTemplateElement) return src.content.textContent ?? "";
  return src.textContent ?? "";
}

export function markCopied(b: HTMLElement): void {
  const lbl = b.querySelector<HTMLElement>(".lbl");
  const was = lbl?.dataset.label ?? lbl?.textContent ?? "";
  if (lbl) lbl.dataset.label = was;
  b.setAttribute("data-done", "");
  if (lbl) lbl.textContent = "Copied";
  announce("Copied to the clipboard");
  clearTimeout(Number(b.dataset.timer));
  b.dataset.timer = String(
    setTimeout(() => {
      b.removeAttribute("data-done");
      if (lbl) lbl.textContent = was;
    }, 1600),
  );
}

function copy(): void {
  document.addEventListener("click", async (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>("[data-copy], [data-copy-from]");
    if (!b) return;
    try {
      await navigator.clipboard.writeText(copyText(b));
      markCopied(b);
    } catch {
      announce("Copy failed: select the text and copy it by hand");
    }
  });
}

/** "On this page": the current section is the last heading scrolled past the band under the header. */
function toc(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc a[href^='#']")];
  if (!links.length) return;
  const targets = links
    .map((a) => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
    .filter((t): t is { a: HTMLAnchorElement; el: HTMLElement } => t.el !== null);
  let raf = 0;
  const pick = (): void => {
    raf = 0;
    const line = (document.querySelector<HTMLElement>("[data-nav]")?.offsetHeight ?? 60) + 32;
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    let current: HTMLAnchorElement | undefined;
    for (const t of targets) if (t.el.getBoundingClientRect().top <= line) current = t.a;
    if (atEnd) current = targets.at(-1)?.a ?? current;
    for (const t of targets)
      t.a === current ? t.a.setAttribute("aria-current", "true") : t.a.removeAttribute("aria-current");
  };
  addEventListener("scroll", () => (raf ||= requestAnimationFrame(pick)), { passive: true });
  addEventListener("resize", () => (raf ||= requestAnimationFrame(pick)), { passive: true });
  pick();
}

/**
 * `<div role="radiogroup" data-seg>` of `<button role="radio" data-value>`: one Tab stop, arrows,
 * Home and End move and select (WAI-ARIA radio group). Fires `segchange` with the value.
 */
export function wireSeg(group: HTMLElement): void {
  if (group.dataset.wired) return;
  group.dataset.wired = "1";
  const radios = (): HTMLButtonElement[] => [...group.querySelectorAll<HTMLButtonElement>("[role=radio]")];
  const select = (b: HTMLButtonElement, focus: boolean): void => {
    radios().forEach((r) => {
      const on = r === b;
      r.setAttribute("aria-checked", String(on));
      r.tabIndex = on ? 0 : -1;
    });
    if (focus) b.focus();
    group.dispatchEvent(new CustomEvent("segchange", { detail: b.dataset.value, bubbles: true }));
  };
  radios().forEach((r) => (r.tabIndex = r.getAttribute("aria-checked") === "true" ? 0 : -1));
  group.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[role=radio]");
    if (b && b.getAttribute("aria-checked") !== "true") select(b, false);
  });
  group.addEventListener("keydown", (e) => {
    const list = radios();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const rtl = getComputedStyle(group).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[e.key];
    let next: HTMLButtonElement | undefined;
    if (step) next = list[(i + step + list.length) % list.length];
    if (e.key === "Home") next = list[0];
    if (e.key === "End") next = list[list.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next, true);
  });
}

/** Set a segmented group's value without user input (e.g. syncing install tabs). */
function setSeg(group: HTMLElement, value: string): void {
  group.querySelectorAll<HTMLButtonElement>("[role=radio]").forEach((r) => {
    const on = r.dataset.value === value;
    r.setAttribute("aria-checked", String(on));
    r.tabIndex = on ? 0 : -1;
  });
}

/** Install blocks: npm / pnpm / bun / yarn, remembered and kept in step across the page. */
function install(): void {
  const blocks = [...document.querySelectorAll<HTMLElement>("[data-install]")];
  if (!blocks.length) return;
  const apply = (pm: string): void => {
    for (const blk of blocks) {
      const cmds = JSON.parse(blk.dataset.install ?? "{}") as Record<string, string>;
      if (!cmds[pm]) continue;
      const seg = blk.querySelector<HTMLElement>("[data-seg]");
      if (seg) setSeg(seg, pm);
      const line = blk.querySelector<HTMLElement>("[data-line]");
      if (line) line.textContent = cmds[pm];
      const btn = blk.querySelector<HTMLElement>(".copy");
      if (btn) btn.dataset.copy = cmds[pm];
    }
  };
  const saved = localStorage.getItem("ikada-pm");
  if (saved && saved !== "npm") apply(saved);
  document.addEventListener("segchange", (e) => {
    const seg = e.target as HTMLElement;
    if (!seg.closest("[data-install]")) return;
    const pm = String((e as CustomEvent).detail);
    localStorage.setItem("ikada-pm", pm);
    apply(pm);
  });
}

/** Block stages: Preview / Code, viewport width, the file shown, a scoped theme. */
function stages(): void {
  document.addEventListener("segchange", (e) => {
    const seg = e.target as HTMLElement;
    const stage = seg.closest<HTMLElement>("[data-bstage]");
    const role = seg.dataset.role;
    if (!stage || !role) return;
    const v = String((e as CustomEvent).detail);
    if (role === "view") stage.dataset.view = v;
    if (role === "vp") stage.querySelector<HTMLElement>(".bview")?.setAttribute("data-vp", v);
    if (role === "file") {
      stage.querySelectorAll<HTMLElement>("[data-file]").forEach((f) => (f.hidden = f.dataset.file !== v));
      const copy = stage.querySelector<HTMLElement>("[data-copy-file]");
      if (copy) copy.dataset.copyFrom = `#${stage.id}-src-${v}`;
    }
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>("[data-stage-theme]");
    const stage = b?.closest<HTMLElement>("[data-bstage]");
    const scope = stage?.querySelector<HTMLElement>("[data-scope]");
    if (!b || !scope) return;
    const now = scope.dataset.theme ?? root.dataset.theme ?? "dark";
    const next = now === "light" ? "dark" : "light";
    setTheme(next, scope);
    b.setAttribute("aria-pressed", String(next !== root.dataset.theme));
    b.setAttribute("aria-label", next === "light" ? "Preview in dark theme" : "Preview in light theme");
  });
}

/** The search palette: ikada's own CommandPalette, loaded the first time it is asked for. */
function search(): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-search]");
  const kbd = btn?.querySelector("[data-kbd]");
  if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform)) kbd.textContent = "Ctrl K";
  let open: (() => void) | null = null;
  let loading = false;
  const go = async (): Promise<void> => {
    if (open) return open();
    if (loading) return;
    loading = true;
    const mod = await import("../components/search-mount");
    open = mod.mountSearch(btn ?? undefined);
    open();
  };
  btn?.addEventListener("click", () => void go());
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !open) {
      e.preventDefault();
      void go();
    }
  });
}

export function boot(): void {
  wireAll();
  themeToggle();
  scrolled();
  distinctLandmarks();
  drawer();
  copy();
  toc();
  document.querySelectorAll<HTMLElement>("[data-seg]").forEach(wireSeg);
  install();
  stages();
  search();
}
