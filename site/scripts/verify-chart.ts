/**
 * Checks the hero chart in headless Chrome (Canvas 2D: no WebGPU, no flags) against a running preview of either site:
 *   bun run build && bun run preview        (another terminal)
 *   bun scripts/verify-chart.ts [what] [--url http://127.0.0.1:4411/ikada/] [--camera raft] [--out <dir>] [--public <dir>]
 * what (default shots, handoff, reduced, perf):
 *   posters   <public>/chart-<camera>-{dark,light}-{1440,390}.webp: the first paint and the no-JS still, rendered from
 *             the chart itself at the page's own layout (?chart=freeze). Regenerate after changing the chart or the hero.
 *   shots     <out>/<prefix>-{1440,390}-{dark,light}-{rest,mid}.png: at rest, and after a vessel, open water and a hold
 *   handoff   leave through a link to the other page: the stored frame vs the new page's first live frame (max channel
 *             difference), and whether the first paint already showed the stored frame (html.chart-exact)
 *   reduced   prefers-reduced-motion: no rAF loop at rest, a static informative frame, a press still answers
 *   perf      frame interval and the chart's own cost per frame, per camera, desktop (1440 x 900 at 2x) and phone
 *             (390 x 844 at 3x, CPU x4), at rest and while interacting, and during a camera glide
 *   rec       <out>/<prefix>-zoom.webm: the page, a press or two, then the link to the other page and back
 *   a11y      the markers are buttons with names and one roving tab stop; Tab, arrows, Enter; hover and focus labels
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1]! : d;
};
const what = argv[0] && !argv[0].startsWith("--") ? argv[0] : "default";
const on = (k: string): boolean =>
  what === k || (what === "default" && ["shots", "handoff", "reduced", "perf"].includes(k));
const URL0 = opt("--url", "http://127.0.0.1:4411/ikada/");
const CAMERA = opt("--camera", "raft");
const PREFIX = opt("--prefix", CAMERA === "raft" ? "ikada" : "sproutboat");
const OUT = resolve(opt("--out", "/tmp/chart-hero-verify"));
const PUBLIC = resolve(opt("--public", join(import.meta.dir, "../public/hero")));
mkdirSync(OUT, { recursive: true });
const H = (w: number): number => (w === 390 ? 844 : 900);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string): void => console.log(s);

const b: Browser = await chromium.launch({ channel: "chrome" });

interface OpenOpts {
  q?: string;
  video?: string;
  dpr?: number;
  reduced?: boolean;
  url?: string;
  throttle?: number;
  height?: number;
}
async function open(width: number, theme: "dark" | "light", o: OpenOpts = {}) {
  const mobile = width === 390;
  const height = o.height ?? H(width);
  const ctx = await b.newContext({
    viewport: { width, height },
    deviceScaleFactor: o.dpr ?? (mobile ? 3 : 2),
    colorScheme: theme,
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: o.reduced ? "reduce" : "no-preference",
    ...(o.video ? { recordVideo: { dir: o.video, size: { width, height } } } : {}),
  });
  await ctx.addInitScript((t) => {
    localStorage.setItem("ikada-theme", t);
    localStorage.setItem("sb-theme", t);
  }, theme);
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300));
  });
  if (o.throttle) {
    const c = await ctx.newCDPSession(p);
    await c.send("Emulation.setCPUThrottlingRate", { rate: o.throttle });
  }
  await p.goto((o.url ?? URL0) + (o.q ?? ""));
  await p.waitForFunction(
    () =>
      (window as any).__hero ||
      document.querySelector("[data-hero-shell], .hero")?.getAttribute("data-backend") === "static",
    null,
    { timeout: 60000 },
  );
  await sleep(700);
  return { ctx, p, errors };
}
const hero = <T>(p: Page, fn: (h: any) => T): Promise<T> =>
  p.evaluate(`(${fn.toString()})(window.__hero)`) as Promise<T>;

/** a vessel to press: one that is visible and clear of the text */
async function aVessel(p: Page, k = 0): Promise<{ x: number; y: number; i: number }> {
  const v = (await hero(p, (h) => h.vessels())) as {
    i: number;
    x: number;
    y: number;
    visible: boolean;
    host: string;
  }[];
  const vis = v.filter((s) => s.visible).sort((a, b2) => b2.x - a.x);
  return vis[Math.min(k, vis.length - 1)]!;
}
async function canvasBox(p: Page) {
  return (await p.evaluate(() => {
    const r = document.querySelector(".hero-canvas")!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  })) as { x: number; y: number; w: number; h: number };
}
/** a press on a vessel, one on open water, and a hold */
async function act(p: Page, W: number) {
  const box = await canvasBox(p);
  const v = await aVessel(p, 1);
  const tap = async (x: number, y: number) => (W === 390 ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  if (v) await tap(box.x + v.x, box.y + v.y);
  await sleep(450);
  const sea = (await hero(p, (h) => {
    const pts = h.vessels().filter((s: any) => s.visible);
    return pts.length;
  })) as number;
  void sea;
  // open water: the deploy click goes where the handle says it can
  for (const f of [
    [0.62, 0.8],
    [0.5, 0.75],
    [0.4, 0.82],
    [0.7, 0.7],
  ] as const) {
    const ok = await hero(p, (h) => h.deploy(0, 0));
    void ok;
    const x = box.w * f[0];
    const y = box.h * f[1];
    const n = (await hero(p, (h) => h.getState().launches.length)) as number;
    await tap(box.x + x, box.y + y);
    await sleep(120);
    const m = (await hero(p, (h) => h.getState().launches.length)) as number;
    if (m > n) break;
  }
  await sleep(900);
}

// ------------------------------------------------------------------------------------------------ posters
if (on("posters")) {
  mkdirSync(PUBLIC, { recursive: true });
  for (const theme of ["dark", "light"] as const)
    for (const width of [1440, 390]) {
      const { ctx, p } = await open(width, theme, { q: "?chart=freeze", dpr: width === 390 ? 2 : 1.5 });
      await p.evaluate(() => document.fonts.ready);
      await sleep(900); // the hero's entrance has landed, the mask is measured
      const url = (await hero(p, (h) => h.snapshot("image/webp", 0.88))) as string;
      const buf = Buffer.from(url.split(",")[1]!, "base64");
      const f = `chart-${CAMERA}-${theme}-${width}.webp`;
      writeFileSync(join(PUBLIC, f), buf);
      log(`poster ${f} · ${(buf.length / 1024).toFixed(0)} KB`);
      await ctx.close();
    }
}

// ------------------------------------------------------------------------------------------------ shots
if (on("shots")) {
  for (const theme of ["dark", "light"] as const)
    for (const width of [1440, 390]) {
      const { ctx, p, errors } = await open(width, theme);
      await sleep(900);
      await p.screenshot({ path: join(OUT, `${PREFIX}-${width}-${theme}-rest.png`) });
      await act(p, width);
      await p.screenshot({ path: join(OUT, `${PREFIX}-${width}-${theme}-mid.png`) });
      if (width === 1440) {
        // a hold: the sweep
        const box = await canvasBox(p);
        await p.mouse.move(box.x + box.w * 0.55, box.y + box.h * 0.8);
        await p.mouse.down();
        await sleep(1300);
        await p.screenshot({ path: join(OUT, `${PREFIX}-${width}-${theme}-sweep.png`) });
        await p.mouse.up();
        const v = await aVessel(p, 2);
        await p.mouse.move(box.x + v.x, box.y + v.y, { steps: 6 });
        await sleep(500);
        await p.screenshot({ path: join(OUT, `${PREFIX}-${width}-${theme}-hover.png`) });
      }
      log(`shots ${PREFIX} ${width} ${theme} · errors: ${errors.length ? errors.join(" | ") : "none"}`);
      await ctx.close();
    }
}

// ------------------------------------------------------------------------------------------------ a11y
if (on("a11y")) {
  const { ctx, p, errors } = await open(1440, "dark");
  const info = (await p.evaluate(() => {
    const ms = [...document.querySelectorAll<HTMLElement>(".sbc-m")];
    const visible = ms.filter((m) => !m.hidden);
    return {
      total: ms.length,
      visible: visible.length,
      buttons: ms.filter((m) => m.tagName === "BUTTON" || m.tagName === "A").length,
      unnamed: visible.filter((m) => !m.getAttribute("aria-label")).length,
      stops: visible.filter((m) => m.tabIndex === 0).length,
      group: !!document.querySelector('[role="group"][aria-label]'),
    };
  })) as Record<string, unknown>;
  log(`a11y markers ${JSON.stringify(info)}`);
  // tab until a marker is focused, then arrows and Enter
  let landed = "";
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press("Tab");
    landed = (await p.evaluate(() => (document.activeElement as HTMLElement)?.className ?? "")) as string;
    if (landed.includes("sbc-m")) break;
  }
  const first = (await p.evaluate(() => document.activeElement?.getAttribute("aria-label"))) as string;
  await p.keyboard.press("ArrowRight");
  const second = (await p.evaluate(() => document.activeElement?.getAttribute("aria-label"))) as string;
  await p.keyboard.press("Enter");
  await sleep(500);
  const woke = (await p.evaluate(() => document.activeElement?.getAttribute("aria-label"))) as string;
  await p.screenshot({ path: join(OUT, `${PREFIX}-focus.png`) });
  log(
    `a11y tab landed on marker: ${landed.includes("sbc-m")} · first "${first}" · next "${second}" · after Enter "${woke}"`,
  );
  log(`a11y errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ reduced
if (on("reduced")) {
  const { ctx, p, errors } = await open(1440, "dark", { reduced: true });
  await sleep(1500);
  const s0 = (await hero(p, (h) => h.stats())) as { frames: number };
  await sleep(1500);
  const s1 = (await hero(p, (h) => h.stats())) as { frames: number };
  await p.screenshot({ path: join(OUT, `${PREFIX}-1440-dark-reduced.png`) });
  const box = await canvasBox(p);
  const v = await aVessel(p, 1);
  await p.mouse.click(box.x + v.x, box.y + v.y);
  await sleep(300);
  const s2 = (await hero(p, (h) => h.stats())) as { frames: number };
  log(
    `reduced frames at rest: ${s0.frames} -> ${s1.frames} (no loop: equal) · after a press: ${s2.frames} · errors ${errors.length ? errors.join(" | ") : "none"}`,
  );
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ perf
if (on("perf")) {
  const rows: string[] = [];
  for (const [name, width, thr] of [
    ["desktop 1440x900 @2x", 1440, 0],
    ["phone 390x844 @3x, CPU x4", 390, 4],
  ] as const) {
    const { ctx, p } = await open(width, "dark", { throttle: thr });
    for (const cam of ["wide", "raft", "corner"] as const) {
      await hero(p, (h) => h.setCamera);
      await p.evaluate((c) => (window as any).__hero.setCamera(c, { animate: false }), cam);
      await sleep(1200);
      const measure = async (label: string, during: () => Promise<void>) => {
        await p.evaluate(() => {
          const w = window as any;
          w.__f = [];
          let last = performance.now();
          const tick = (t: number) => {
            w.__f.push(t - last);
            last = t;
            w.__raf = requestAnimationFrame(tick);
          };
          w.__raf = requestAnimationFrame(tick);
        });
        const s0 = (await hero(p, (h) => h.stats())) as { frames: number; cpuMs: number };
        await during();
        const f = (await p.evaluate(() => {
          const w = window as any;
          cancelAnimationFrame(w.__raf);
          return w.__f.slice(2) as number[];
        })) as number[];
        const s1 = (await hero(p, (h) => h.stats())) as {
          frames: number;
          cpuMs: number;
          p95Ms: number;
          maxMs: number;
          dpr: number;
        };
        const sorted = f.slice().sort((a, c) => a - c);
        const total = f.reduce((a, c) => a + c, 0);
        const fps = (f.length / total) * 1000;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        const dropped = f.filter((x) => x > 25).length;
        rows.push(
          `${name} · ${cam} · ${label}: ${fps.toFixed(1)} fps · frame p95 ${p95.toFixed(1)} ms · >25ms ${dropped}/${f.length} · chart cost mean ${s1.cpuMs.toFixed(2)} ms p95 ${s1.p95Ms.toFixed(2)} max ${s1.maxMs.toFixed(1)} · dpr ${s1.dpr}`,
        );
        void s0;
      };
      await measure("rest (idle demo)", async () => {
        await sleep(4000);
      });
      await measure("interacting", async () => {
        const box = await canvasBox(p);
        for (let i = 0; i < 4; i++) {
          const v = await aVessel(p, i);
          if (v) await p.evaluate((i2) => (window as any).__hero.wake(i2), v.i);
          await p.evaluate(([x, y]) => (window as any).__hero.deploy(x, y), [box.w * (0.45 + i * 0.1), box.h * 0.8]);
          await sleep(500);
        }
        await p.evaluate(() => (window as any).__hero.sweep());
        await sleep(2600);
      });
    }
    // a glide between cameras (the zoom): every frame of the move
    for (const [a, c] of [
      ["wide", "raft"],
      ["raft", "wide"],
      ["wide", "corner"],
    ] as const) {
      await p.evaluate((x) => (window as any).__hero.setCamera(x, { animate: false }), a);
      await sleep(900);
      await p.evaluate(() => {
        const w = window as any;
        w.__f = [];
        let last = performance.now();
        const tick = (t: number) => {
          w.__f.push(t - last);
          last = t;
          w.__raf = requestAnimationFrame(tick);
        };
        w.__raf = requestAnimationFrame(tick);
      });
      await p.evaluate((x) => (window as any).__hero.setCamera(x), c);
      await sleep(1100);
      const f = (await p.evaluate(() => {
        const w = window as any;
        cancelAnimationFrame(w.__raf);
        return w.__f.slice(1) as number[];
      })) as number[];
      const live = f.slice(0, Math.round(f.length * 0.75));
      const total = live.reduce((x, y) => x + y, 0);
      rows.push(
        `${name} · glide ${a} -> ${c}: ${((live.length / total) * 1000).toFixed(1)} fps · worst frame ${Math.max(...live).toFixed(1)} ms · >25ms ${live.filter((x) => x > 25).length}/${live.length}`,
      );
    }
    await ctx.close();
  }
  for (const r of rows) log(r);
}

// ------------------------------------------------------------------------------------------------ handoff
if (on("handoff")) {
  const other = opt("--other", "http://127.0.0.1:4421/");
  for (const [from, to, label] of [
    [URL0, other, "this page -> other"],
    [other, URL0, "other -> this page"],
  ] as const) {
    const { ctx, p, errors } = await open(1440, "dark", { url: from });
    await sleep(1500);
    await act(p, 1440);
    const link = to.includes("/ikada") ? 'a[href="/ikada"], a[href="/ikada/"]' : 'a[href="/"]';
    void link;
    // debug capture on the next page
    const next = await ctx.newPage();
    await next.close();
    const nav = p.waitForURL((u) => u.toString().startsWith(to.split("?")[0]!), { timeout: 15000 });
    await p.evaluate((u) => {
      const a = document.createElement("a");
      a.href = u;
      a.textContent = "go";
      a.style.cssText = "position:fixed;left:0;top:0;opacity:0";
      document.body.appendChild(a);
      a.click();
    }, to + "?chart=debug");
    await nav;
    await p.waitForFunction(() => (window as any).__hero, null, { timeout: 15000 });
    await sleep(400);
    const r = (await p.evaluate(async () => {
      const w = window as any;
      const ho = w.__chartHandoff;
      const first: string | undefined = w.__firstFrame;
      const exact = document.documentElement.classList.contains("chart-exact");
      if (!ho?.snap || !first) return { exact, have: false };
      const dec = async (u: string) => {
        const im = new Image();
        im.src = u;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const x = c.getContext("2d")!;
        x.drawImage(im, 0, 0);
        return x.getImageData(0, 0, c.width, c.height);
      };
      const [A, B] = await Promise.all([dec(ho.snap), dec(first)]);
      if (A.width !== B.width || A.height !== B.height)
        return { exact, have: true, size: [A.width, A.height, B.width, B.height] };
      let max = 0;
      let n = 0;
      for (let i = 0; i < A.data.length; i += 4)
        for (let k = 0; k < 3; k++) {
          const d = Math.abs(A.data[i + k]! - B.data[i + k]!);
          if (d > max) max = d;
          if (d > 8) n++;
        }
      return { exact, have: true, max, over8: n, camFrom: ho.camera };
    })) as Record<string, unknown>;
    log(`handoff ${label}: ${JSON.stringify(r)} · errors ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ rec
if (on("rec")) {
  const other = opt("--other", "http://127.0.0.1:4421/");
  const start = opt("--start", other);
  const dir = join(OUT, "rec-tmp");
  rmSync(dir, { recursive: true, force: true });
  const { ctx, p } = await open(1440, "dark", { video: dir, url: start });
  const box = async () => canvasBox(p);
  await sleep(1800);
  // a vessel, then open water
  let bx = await box();
  let v = await aVessel(p, 2);
  await p.mouse.move(bx.x + bx.w * 0.5, bx.y + bx.h * 0.5, { steps: 12 });
  await p.mouse.move(bx.x + v.x, bx.y + v.y, { steps: 14 });
  await sleep(500);
  await p.mouse.click(bx.x + v.x, bx.y + v.y);
  await sleep(1500);
  await p.mouse.move(bx.x + bx.w * 0.45, bx.y + bx.h * 0.8, { steps: 16 });
  await p.mouse.click(bx.x + bx.w * 0.45, bx.y + bx.h * 0.8);
  await sleep(2200);
  // zoom in: the raft marker (a link) on sproutboat.com, the nav link on ikada
  const go = async (sel: string) => {
    const loc = p.locator(sel).first();
    await loc.hover();
    await sleep(350);
    await Promise.all([p.waitForNavigation({ waitUntil: "load" }).catch(() => {}), loc.click()]);
    await p.waitForFunction(() => (window as any).__hero, null, { timeout: 15000 });
  };
  await go('.nav-links a[href^="/ikada"], .sbc-m[href="/ikada"]');
  await sleep(2600);
  bx = await box();
  v = await aVessel(p, 0);
  if (v) {
    await p.mouse.move(bx.x + v.x, bx.y + v.y, { steps: 18 });
    await sleep(400);
    await p.mouse.click(bx.x + v.x, bx.y + v.y);
  }
  await sleep(1800);
  // and back out: the browser's Back
  await sleep(300);
  await Promise.all([p.waitForNavigation({ waitUntil: "load" }).catch(() => {}), p.goBack()]);
  await sleep(3600);
  await ctx.close();
  const f = readdirSync(dir).find((x) => x.endsWith(".webm"));
  if (f) renameSync(join(dir, f), join(OUT, `${PREFIX}-zoom.webm`));
  rmSync(dir, { recursive: true, force: true });
  log(`rec ${join(OUT, `${PREFIX}-zoom.webm`)}`);
}

// ------------------------------------------------------------------------------------------------ hold
/** press and hold: the ring charges, the sweep starts and wakes vessels, a release does not deploy; a short click still does */
if ((on("hold") || what === "hold") && CAMERA === "raft") {
  // /ikada: the blueprint sheet covers the chart, so a press or a hold on it must do nothing to the chart
  const { ctx, p } = await open(1440, "dark", { url: URL0 });
  await sleep(4500);
  const box0 = await canvasBox(p);
  await p.mouse.move(box0.x + box0.w * 0.55, box0.y + box0.h * 0.55);
  await p.mouse.down();
  await sleep(1200);
  const s = (await hero(p, (h) => {
    const t = h.getState();
    return { sweep: !!t.sweep, launches: t.launches.length };
  })) as { sweep: boolean; launches: number };
  await p.mouse.up();
  log(
    `hold ${!s.sweep && s.launches === 0 ? "PASS" : "FAIL"} · /ikada: a hold on the blueprint sheet starts no sweep and deploys nothing (sweep ${s.sweep}, launches ${s.launches}); the hold test proper runs on sproutboat.com`,
  );
  await ctx.close();
} else if (on("hold") || what === "hold") {
  const state = (p: Page) =>
    hero(p, (h) => {
      const s = h.getState();
      return {
        sweep: s.sweep ? { held: s.sweep.held, woken: s.sweep.woken, auto: s.sweep.auto } : null,
        launches: s.launches.length,
        dyn: s.dyn.length,
        sw: s.ships.filter((r: any) => r.sw >= 0).length,
      };
    }) as Promise<{
      sweep: null | { held: boolean; woken: number; auto: boolean };
      launches: number;
      dyn: number;
      sw: number;
    }>;
  const seaPoint = async (p: Page) => {
    const box = await canvasBox(p);
    return {
      box,
      x: box.x + box.w * (CAMERA === "wide" ? 0.58 : 0.42),
      y: box.y + box.h * (box.w < 700 ? 0.86 : 0.82),
    };
  };
  const result = (name: string, ok: boolean, detail: string) =>
    log(`hold ${ok ? "PASS" : "FAIL"} · ${name} · ${detail}`);
  for (const variant of ["desktop", "reduced", "touch"] as const) {
    const touch = variant === "touch";
    const { ctx, p } = await open(touch ? 390 : 1440, "dark", { reduced: variant === "reduced" });
    await sleep(800);
    // the idle demo must not be what we measure
    const { box, x, y } = await seaPoint(p);
    const cdp = await ctx.newCDPSession(p);
    const down = async (px: number, py: number) =>
      touch
        ? cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: px, y: py }] })
        : (await p.mouse.move(px, py), p.mouse.down());
    const up = async () =>
      touch ? cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }) : p.mouse.up();
    const quiet = () => hero(p, (h) => h.wake(0)); // a press resets the idle demo, so it does not launch or sweep while we measure
    await quiet();
    // 1. hold on open water
    const s0 = await state(p);
    await down(x, y);
    await sleep(300);
    await p.screenshot({
      path: join(OUT, `${PREFIX}-hold-${variant}-charging.png`),
      clip: { x: Math.max(0, x - 90), y: Math.max(0, y - 90), width: 180, height: 180 },
    });
    await sleep(900);
    const s1 = await state(p);
    await p.screenshot({ path: join(OUT, `${PREFIX}-hold-${variant}-sweeping.png`) });
    await up();
    await sleep(3400);
    const s2 = await state(p);
    result(
      `${variant} hold on open water`,
      !!s1.sweep && s1.sweep.held && !s1.sweep.auto && s2.launches === s0.launches && s2.dyn === s0.dyn && s2.sw > 0,
      `sweep started: ${!!s1.sweep}, held: ${s1.sweep?.held}, vessels woken by the sweep: ${s2.sw}, deployed on release: ${s2.dyn - s0.dyn + s2.launches - s0.launches}`,
    );
    // 2. a short press still deploys
    await sleep(2000);
    await quiet();
    const c0 = await state(p);
    // a spot of open water the chart itself accepts (not land, the text, the furniture)
    const spot = (await p.evaluate(() => {
      const h = (window as any).__hero;
      const c = document.querySelector(".hero-canvas")!.getBoundingClientRect();
      for (let fy = 0.5; fy < 0.95; fy += 0.04)
        for (let fx = 0.1; fx < 0.95; fx += 0.04)
          if (
            h.canDeploy(c.width * fx, c.height * fy) &&
            !h.vessels().some((v: any) => v.visible && Math.hypot(v.x - c.width * fx, v.y - c.height * fy) < 70) &&
            Math.hypot(h.raftPoint().x - c.width * fx, h.raftPoint().y - c.height * fy) < 9999
          )
            return [c.width * fx, c.height * fy];
      return null;
    })) as number[] | null;
    await down(box.x + (spot?.[0] ?? 0), box.y + (spot?.[1] ?? 0));
    await sleep(90);
    await up();
    await sleep(300);
    const c1 = await state(p);
    result(
      `${variant} short press deploys`,
      c1.launches + c1.dyn > c0.launches + c0.dyn && !c1.sweep?.held,
      `launches ${c0.launches}->${c1.launches}`,
    );
    // 3. hold on a vessel
    await sleep(2500);
    await quiet();
    const v = await aVessel(p, 1);
    const h0 = await state(p);
    await down(box.x + v.x, box.y + v.y);
    await sleep(900);
    const h1 = await state(p);
    await up();
    result(`${variant} hold on a vessel`, !!h1.sweep && h1.sweep.held, `sweep started: ${!!h1.sweep}`);
    void h0;
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ blueprint
/** the /ikada blueprint sheet: it opens, the parts are keyboard-reachable buttons that show the real components, Escape closes */
if (on("blueprint") || what === "blueprint") {
  const result = (name: string, ok: boolean, detail: string) =>
    log(`blueprint ${ok ? "PASS" : "FAIL"} · ${name} · ${detail}`);
  for (const [w, theme] of [
    [1440, "dark"],
    [1440, "light"],
    [390, "light"],
    [390, "dark"],
  ] as const) {
    const mobile = w === 390;
    const { ctx, p, errors } = await open(w, theme, { url: URL0 });
    await sleep(4500); // the ink has drawn
    const opened = (await p.evaluate(() =>
      document.querySelector("[data-hero-shell]")?.getAttribute("data-blueprint"),
    )) as string;
    await p.screenshot({ path: join(OUT, `${PREFIX}-${w}-${theme}-sheet-rest.png`) });
    const labels = (await p.evaluate(() =>
      [...document.querySelectorAll<SVGElement>(".sheet .lab")].map((l) => l.getAttribute("aria-label")),
    )) as string[];
    result(
      `${w} ${theme} sheet opens`,
      opened === "open" && labels.length === 7,
      `state ${opened}, ${labels.length} labelled parts: ${labels.join(", ")}`,
    );
    // pointer or tap: the Tabs part (label 04)
    const tabs = p.locator('.sheet .lab[aria-label*="Tabs"]');
    if (mobile) await tabs.tap();
    else await tabs.click();
    await sleep(600);
    const co = (await p.evaluate(() => ({
      callout: !!document.querySelector(".callout"),
      tabs: document.querySelectorAll(".callout [role=tab]").length,
      label: document.querySelector(".callout")?.getAttribute("aria-label"),
    }))) as { callout: boolean; tabs: number; label: string | null };
    await p.screenshot({ path: join(OUT, `${PREFIX}-${w}-${theme}-sheet-tabs.png`) });
    result(
      `${w} ${theme} a part shows the real component`,
      co.callout && co.tabs === 3,
      `${co.label}, ${co.tabs} tabs`,
    );
    await p.keyboard.press("Escape");
    await sleep(300);
    const closed = (await p.evaluate(() => !document.querySelector(".callout"))) as boolean;
    result(`${w} ${theme} Escape closes the callout`, closed, "");
    if (!mobile && theme === "dark") {
      // keyboard: Tab to a numbered label, Enter pins it and moves focus into the callout; Escape returns to the label
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await p.locator('.sheet .lab[aria-label*="Dialog"]').focus();
      await p.keyboard.press("Enter");
      await sleep(500);
      const inCallout = (await p.evaluate(
        () => !!document.activeElement?.closest(".callout") || document.activeElement?.classList.contains("callout"),
      )) as boolean;
      for (let k = 0; k < 4; k++) {
        await p.keyboard.press("Tab");
        if (((await p.evaluate(() => document.activeElement?.textContent)) ?? "").includes("Delete")) break;
      }
      await p.keyboard.press("Enter"); // the Delete app… trigger
      await sleep(600);
      const dlg = (await p.evaluate(() => !!document.querySelector('[role="dialog"]:not(.callout)'))) as boolean;
      await p.screenshot({ path: join(OUT, `${PREFIX}-${w}-${theme}-sheet-dialog.png`) });
      await p.keyboard.press("Escape");
      await sleep(900);
      const dlgGone = (await p.evaluate(() => !document.querySelector('[role="dialog"]:not(.callout)'))) as boolean;
      const stillCallout = (await p.evaluate(() => !!document.querySelector(".callout"))) as boolean;
      await p.keyboard.press("Escape");
      await sleep(500);
      const back = (await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")) as string;
      result(
        `${w} ${theme} keyboard: Enter pins and focuses the callout, a Dialog opens and Escape closes only it, a second Escape returns to the label`,
        inCallout && dlg && dlgGone && stillCallout && /Dialog/.test(back),
        `focus in callout ${inCallout}, dialog ${dlg}->${dlgGone}, callout kept ${stillCallout}, focus back on "${back}"`,
      );
    }
    result(`${w} ${theme} console`, errors.length === 0, errors.length ? errors.join(" | ") : "no errors");
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ reveal
/** frame times from document start to 5 s on a fresh load (the chart's glide, the paper opening, the ink drawing on) */
if (what === "reveal") {
  for (const [name, w, thr] of [
    ["desktop 1440x900 @2x", 1440, 0],
    ["phone 390x844 @3x, CPU x4", 390, 4],
  ] as const) {
    const mobile = w === 390;
    const ctx = await b.newContext({
      viewport: { width: w, height: mobile ? 844 : 900 },
      deviceScaleFactor: mobile ? 3 : 2,
      isMobile: mobile,
      hasTouch: mobile,
      colorScheme: "dark",
    });
    await ctx.addInitScript(() => {
      const w2 = window as any;
      w2.__f = [];
      w2.__lt = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) w2.__lt.push([e.startTime, e.duration]);
        }).observe({ type: "longtask", buffered: true });
      } catch {}
      let last = performance.now();
      const tick = (t: number) => {
        w2.__f.push([t, t - last]);
        last = t;
        if (t < 6000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const p = await ctx.newPage();
    if (thr) await (await ctx.newCDPSession(p)).send("Emulation.setCPUThrottlingRate", { rate: thr });
    await p.goto(URL0);
    await sleep(6500);
    const f = (await p.evaluate(() => (window as any).__f)) as [number, number][];
    const lt = (await p.evaluate(() => (window as any).__lt)) as [number, number][];
    log(
      `reveal ${name} · long tasks (>50 ms) in the first 6 s: ${lt.length}, longest ${Math.max(0, ...lt.map((x) => x[1])).toFixed(0)} ms, total ${lt.reduce((a, x) => a + x[1], 0).toFixed(0)} ms; the ones after 2 s: ${lt.filter((x) => x[0] > 2000).length}`,
    );
    const seg = (a: number, z: number) => f.filter(([t]) => t >= a && t < z).map(([, d]) => d);
    for (const [label, a, z] of [
      ["0-2 s (load, chart, paper opens)", 0, 2000],
      ["2-5 s (ink draws on)", 2000, 5000],
    ] as const) {
      const d = seg(a, z).slice(1);
      const total = d.reduce((x, y) => x + y, 0);
      const sorted = d.slice().sort((x, y) => x - y);
      log(
        `reveal ${name} · ${label}: ${((d.length / total) * 1000).toFixed(1)} fps · worst frame ${Math.max(...d).toFixed(1)} ms · p95 ${sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1)} ms · >25 ms ${d.filter((x) => x > 25).length}/${d.length}`,
      );
    }
    await ctx.close();
  }
}

await b.close();
