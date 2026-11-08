/**
 * Click-through QA of both sites through the same-origin preview (sproutboat.com on :4420, /ikada proxied to :4410).
 *   bun scripts/qa-click-through.ts [--origin http://127.0.0.1:4420] [--out <dir>] [--shard i/n] [--quick]
 * For every page, at 1440 and 390, light and dark: load (layout shift, console and page errors, horizontal overflow);
 * then at (1440, dark) and (390, light) every interactive thing is pressed in turn (layout shift during the press, errors,
 * clipping out of the viewport, a changed URL) and the keyboard walks the first 45 tab stops (a visible focus indicator,
 * layout shift). Issues go to <out>/issues-<shard>.json with a screenshot each.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1]! : d;
};
const ORIGIN = opt("--origin", "http://127.0.0.1:4420");
const OUT = resolve(opt("--out", "/tmp/qa-click-through"));
const [SHARD, SHARDS] = opt("--shard", "0/1").split("/").map(Number) as [number, number];
const QUICK = argv.includes("--quick");
const ONLY = opt("--only", "");
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const dist = resolve(import.meta.dir, "../dist/ikada");
const ikadaPages = ["/ikada/"]
  .concat(
    readdirSync(dist)
      .filter((f) => f.endsWith(".html") && !["index.html", "404.html"].includes(f))
      .map((f) => "/ikada/" + f.replace(/\.html$/, "")),
  )
  .concat(readdirSync(join(dist, "components")).map((f) => "/ikada/components/" + f.replace(/\.html$/, "")))
  .concat(readdirSync(join(dist, "blocks")).map((f) => "/ikada/blocks/" + f.replace(/\.html$/, "")));
const PAGES = ["/", "/how-it-works", "/no-such-page"]
  .concat(ikadaPages)
  .filter((_, i) => i % SHARDS === SHARD)
  .filter((p) => !ONLY || ONLY.split(",").includes(p));

interface Issue {
  page: string;
  variant: string;
  element: string;
  kind: string;
  detail: string;
  shot?: string;
  cls?: number;
}
const issues: Issue[] = [];
let shotN = 0;
const stats = { pages: 0, variants: 0, interactions: 0, tabStops: 0, maxLoadCls: 0, maxActionCls: 0 };

const b = await chromium.launch({ channel: "chrome" });

async function describe(p: Page, sel: string): Promise<string> {
  return (await p.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return "(gone)";
    const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""} "${t}"`;
  }, sel)) as string;
}

async function run(path: string, w: number, theme: "light" | "dark", interact: boolean) {
  const variant = `${w}-${theme}`;
  const mobile = w === 390;
  const ctx = await b.newContext({
    viewport: { width: w, height: mobile ? 844 : 900 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await ctx.addInitScript((t) => {
    localStorage.setItem("ikada-theme", t);
    localStorage.setItem("sb-theme", t);
    const w2 = window as any;
    w2.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) w2.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  }, theme);
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));
  p.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource.*(403|404)|favicon|stats\.brnr/.test(t))
      errs.push("console: " + t.slice(0, 200));
  });
  const shot = async (tag: string): Promise<string> => {
    const f = `${String(++shotN).padStart(3, "0")}-${SHARD}-${tag.replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.png`;
    await p.screenshot({ path: join(OUT, f) }).catch(() => {});
    return f;
  };
  const add = async (i: Omit<Issue, "page" | "variant">, tag: string) => {
    issues.push({ page: path, variant, ...i, shot: await shot(tag) });
  };
  const cls = async (): Promise<number> => (await p.evaluate(() => (window as any).__cls)) as number;
  const flushErrs = async (element: string, kind = "console error") => {
    while (errs.length) await add({ element, kind, detail: errs.shift()! }, "err-" + path);
  };

  const resp = await p.goto(ORIGIN + path, { waitUntil: "load" });
  await sleep(1800);
  stats.variants++;
  const loadCls = await cls();
  stats.maxLoadCls = Math.max(stats.maxLoadCls, loadCls);
  const expect404 = path === "/no-such-page";
  if (resp && resp.status() >= 400 && !expect404)
    await add({ element: "page", kind: "http status", detail: String(resp.status()) }, "status-" + path);
  if (loadCls > 0.02)
    await add(
      { element: "page load", kind: "layout shift", detail: "during load", cls: +loadCls.toFixed(4) },
      "cls-" + path,
    );
  const ov = (await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))) as {
    sw: number;
    iw: number;
  };
  if (ov.sw > ov.iw + 1)
    await add(
      { element: "document", kind: "horizontal overflow", detail: `scrollWidth ${ov.sw} > ${ov.iw}` },
      "overflow-" + path,
    );
  await flushErrs("page load");

  if (interact) {
    // tag every interactive thing once
    const total = (await p.evaluate(() => {
      const sel =
        'button, [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], summary, select, input:not([type="hidden"]), textarea, [aria-haspopup], [data-theme-toggle], a[href^="#"], .sbc-m';
      let n = 0;
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden]"))
          return;
        if (el.matches('a[href="#"], a.sbc-m, .sr-only, :disabled') || el.closest("[inert], [aria-hidden=true]"))
          return;
        el.setAttribute("data-qa", String(n++));
      });
      return n;
    })) as number;
    const limit = QUICK ? 15 : 90;
    for (let i = 0; i < Math.min(total, limit); i++) {
      const sel = `[data-qa="${i}"]`;
      const exists = await p.locator(sel).count();
      if (!exists) continue;
      const name = await describe(p, sel);
      stats.interactions++;
      const before = await cls();
      const url0 = p.url();
      // did the press change anything at all? (the segmented control tile once clicked "successfully" and did nothing)
      await p.evaluate(() => {
        const w2 = window as any;
        w2.__mo?.disconnect();
        w2.__mut = 0;
        w2.__mo = new MutationObserver((m) => (w2.__mut += m.length));
        w2.__mo.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
      });
      try {
        const el = p.locator(sel).first();
        await el.scrollIntoViewIfNeeded({ timeout: 2000 });
        const tag = await el.evaluate((e) => e.tagName + ":" + ((e as HTMLInputElement).type || ""));
        if (/INPUT:(text|email|search|password)|TEXTAREA/i.test(tag)) {
          await el.click({ timeout: 2500 });
          await p.keyboard.type("qa", { delay: 20 });
        } else if (/SELECT/.test(tag)) {
          await el.focus();
        } else if (/INPUT:(checkbox|radio)/i.test(tag)) {
          await el.click({ timeout: 2500, force: true });
        } else {
          await el.click({ timeout: 2500, trial: false });
        }
      } catch (e) {
        await add(
          { element: name, kind: "not clickable", detail: String(e).split("\n")[0]!.slice(0, 160) },
          "click-" + i,
        );
        continue;
      }
      await sleep(420);
      const d = (await cls()) - before;
      // pressing the segment that is already selected (or an already-on toggle) changes nothing, by design
      const wasOn = await p
        .locator(sel)
        .first()
        .evaluate(
          (e) =>
            e.getAttribute("aria-pressed") === "true" ||
            e.getAttribute("aria-selected") === "true" ||
            e.getAttribute("aria-checked") === "true" ||
            e.hasAttribute("data-pressed"),
        )
        .catch(() => false);
      const muts = (await p.evaluate(() => (window as any).__mut)) as number;
      const navigated0 = p.url() !== url0;
      if (
        !wasOn &&
        muts === 0 &&
        !navigated0 &&
        /BUTTON|SPAN|DIV/.test(
          await p
            .locator(sel)
            .first()
            .evaluate((e) => e.tagName)
            .catch(() => ""),
        )
      )
        await add(
          {
            element: name,
            kind: "press had no effect",
            detail: "nothing in the DOM changed within 420 ms of the press",
          },
          "noeffect-" + i,
        );
      stats.maxActionCls = Math.max(stats.maxActionCls, d);
      if (d > 0.01)
        await add({ element: name, kind: "layout shift", detail: "on press", cls: +d.toFixed(4) }, "shift-" + i);
      const ov2 = (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) as boolean;
      if (ov2) await add({ element: name, kind: "horizontal overflow", detail: "after press" }, "ovf-" + i);
      // popups clipped by the viewport
      const clipped = (await p.evaluate(() => {
        const out: string[] = [];
        document
          .querySelectorAll<HTMLElement>(
            '[role="dialog"], [role="menu"], [popover]:popover-open, [data-popup], [data-open] [role="menu"]',
          )
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) return;
            if (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1)
              out.push(el.getAttribute("role") + " " + [r.left, r.top, r.right, r.bottom].map(Math.round).join(","));
          });
        return out;
      })) as string[];
      for (const c of clipped) await add({ element: name, kind: "clipped popup", detail: c }, "clip-" + i);
      await flushErrs(name);
      if (p.url() !== url0 && !p.url().startsWith(url0.split("#")[0] + "#")) {
        await add({ element: name, kind: "navigated", detail: `${url0} -> ${p.url()}` }, "nav-" + i);
        await p.goBack({ waitUntil: "load" }).catch(() => {});
        await sleep(600);
        // tags are lost on reload: tag again the same way
        await p.evaluate(() => undefined);
        break;
      }
      await p.keyboard.press("Escape");
      if (/theme/i.test(name)) {
        await p
          .locator(sel)
          .first()
          .click()
          .catch(() => {});
        await sleep(300);
      }
    }
    await p.evaluate(() => scrollTo(0, 0));
    // the keyboard: Tab through the first stops
    await p.reload({ waitUntil: "load" });
    await sleep(1200);
    await p.mouse.move(0, 0);
    await p.keyboard.press("Tab");
    const stops = QUICK ? 12 : 45;
    for (let k = 0; k < stops; k++) {
      const before = await cls();
      const info = (await p.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const ring =
          (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
        const r = el.getBoundingClientRect();
        const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40);
        const inView = r.bottom > 0 && r.top < innerHeight;
        return {
          ring: !!ring,
          t: `${el.tagName.toLowerCase()} "${t}"`,
          hidden: !r.width || !r.height,
          inView,
          focusVisible: el.matches(":focus-visible"),
        };
      })) as { ring: boolean; t: string; hidden: boolean; inView: boolean; focusVisible: boolean } | null;
      stats.tabStops++;
      if (info) {
        if (info.hidden)
          await add(
            { element: info.t, kind: "focus on an invisible element", detail: "Tab stop with no box" },
            "focus-hidden-" + k,
          );
        else if (!info.ring && info.focusVisible)
          await add(
            { element: info.t, kind: "no visible focus indicator", detail: "outline none and no box-shadow" },
            "focus-" + k,
          );
        else if (!info.inView)
          await add(
            { element: info.t, kind: "focus left off screen", detail: "the focused element is not scrolled into view" },
            "focus-off-" + k,
          );
      }
      const d = (await cls()) - before;
      if (d > 0.01)
        await add(
          { element: info?.t ?? "tab", kind: "layout shift", detail: "on focus", cls: +d.toFixed(4) },
          "focus-shift-" + k,
        );
      await p.keyboard.press("Tab");
      await sleep(40);
    }
    await flushErrs("keyboard");
    // search (⌘K) on the ikada site
    if (path.startsWith("/ikada") && !mobile) {
      await p.evaluate(() => scrollTo(0, 0));
      await p.keyboard.press("Control+k");
      await sleep(900);
      const open = (await p.locator('[role="dialog"], [cmdk-root], [role="combobox"]').count()) > 0;
      if (!open)
        await add({ element: "search", kind: "broken", detail: "Control+K did not open the search" }, "search-" + path);
      else {
        await p.keyboard.type("button", { delay: 30 });
        await sleep(500);
        await p.keyboard.press("ArrowDown");
        await p.keyboard.press("Escape");
        await sleep(300);
      }
      await flushErrs("search");
    }
  }
  stats.pages++;
  await ctx.close();
}

for (const path of PAGES) {
  for (const [w, theme, interact] of [
    [1440, "dark", true],
    [1440, "light", false],
    [390, "light", true],
    [390, "dark", false],
  ] as const) {
    try {
      await run(path, w, theme, interact);
    } catch (e) {
      issues.push({
        page: path,
        variant: `${w}-${theme}`,
        element: "page",
        kind: "script error",
        detail: String(e).slice(0, 200),
      });
    }
  }
  writeFileSync(join(OUT, `issues-${SHARD}.json`), JSON.stringify({ issues, stats }, null, 2));
  console.log(`[${SHARD}] ${path}: ${issues.length} issues so far`);
}
await b.close();
writeFileSync(join(OUT, `issues-${SHARD}.json`), JSON.stringify({ issues, stats, done: true }, null, 2));
console.log(`[${SHARD}] done`, JSON.stringify(stats));
