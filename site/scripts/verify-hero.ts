/**
 * Checks the homepage hero (Raft at dusk) in headless Chrome with WebGPU, against a running preview:
 *   bun run build && bun run preview        (another terminal)
 *   bun scripts/verify-hero.ts [what] [--out <dir>] [--url http://127.0.0.1:4410/ikada/]
 * what (default all):
 *   posters   public/hero/dusk-raft-{dark,light}-{1440,390}.webp, the first paint and the no-WebGPU still, rendered
 *             from the scene itself at the homepage's own layout (regenerate after changing the scene or the hero)
 *   shots     {dark,light}-{1440,390}.png after the scene renders and a little interaction, into --out
 *   contrast  worst rendered pixel under the headline (≥ 3:1), the lede and the nav (≥ 4.5:1), both themes and widths
 *   handoff   leave the page through a link to itself: last frame before vs first frame after (max channel difference),
 *             and whether the first paint already shows the stored frame; then the same from the wide camera (glide)
 *   reduced   prefers-reduced-motion: one frame, no rAF loop, presses ignored, camera changes cut
 *   static    no WebGPU: the poster stays, no canvas, no errors
 *   perf      raw pass time while interacting, and the full-clock cost (?bench=10)
 *   rec       hero-interaction.webm (cursor, presses, theme) and hero-glide.webm (raft → wide → sky → raft), into --out
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const what = argv[0] && !argv[0].startsWith("--") ? argv[0] : "all";
const on = (k: string): boolean => what === k || what === "all";
const URL0 = opt("--url", "http://127.0.0.1:4410/ikada/");
const OUT = resolve(opt("--out", "/tmp/ikada-hero-verify"));
const PUBLIC = join(import.meta.dir, "../public/hero");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
const H = (w: number): number => (w === 390 ? 844 : 900);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const report: string[] = [];
const log = (s: string): void => {
  console.log(s);
  report.push(s);
};

const b: Browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU"],
});

interface OpenOpts {
  q?: string;
  video?: string;
  dpr?: number;
  reduced?: boolean;
  noGpu?: boolean;
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
  await ctx.addInitScript((t) => localStorage.setItem("ikada-theme", t), theme);
  if (o.noGpu)
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined }));
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !/favicon/.test(m.text()))
      errors.push(m.text().slice(0, 300));
  });
  await p.goto(URL0 + (o.q ?? ""));
  await p.waitForFunction(
    () =>
      (window as any).__hero || document.querySelector("[data-hero-shell]")?.getAttribute("data-backend") === "static",
    null,
    { timeout: 20000 },
  );
  await p.waitForFunction(
    () => {
      const c = document.querySelector(".hero-canvas");
      return (
        !c ||
        c.classList.contains("on") ||
        document.querySelector("[data-hero-shell]")?.getAttribute("data-backend") === "static"
      );
    },
    null,
    { timeout: 20000 },
  );
  await sleep(600); // canvas fade-in
  return { ctx, p, errors };
}

async function sweep(p: Page, ms: number, cx: number, cy: number, rx: number, ry: number) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = (Date.now() - t0) / 1000;
    await p.mouse.move(cx + Math.sin(t * 1.1) * rx, cy + Math.sin(t * 1.8 + 0.6) * ry);
    await sleep(16);
  }
}
/** a cursor sweep and two presses on the sea (mouse), or two taps (touch) */
async function act(p: Page, W: number) {
  const Hh = H(W);
  if (W === 390) {
    await p.touchscreen.tap(W * 0.2, Hh * 0.93);
    await sleep(500);
    await p.touchscreen.tap(W * 0.82, Hh * 0.78);
    await sleep(1500);
    return;
  }
  await p.mouse.move(W * 0.5, Hh * 0.5);
  await sweep(p, 1500, W * 0.5, Hh * 0.55, 320, 120);
  await p.mouse.click(W * 0.28, Hh * 0.9);
  await sleep(350);
  await p.mouse.click(W * 0.72, Hh * 0.95);
  await sleep(1300);
  await p.mouse.move(W * 0.62, Hh * 0.4, { steps: 24 });
  await sleep(600);
}

// ------------------------------------------------------------------------------------------------ posters
if (on("posters")) {
  for (const theme of ["dark", "light"] as const)
    for (const width of [1440, 390]) {
      // reduced motion renders the fresh, pre-settled state: the same picture a fresh load starts from
      const { ctx, p } = await open(width, theme, { reduced: true, dpr: 1 });
      await sleep(400);
      const url = await p.evaluate(() => (window as any).__hero.snapshot("image/webp", 0.86));
      const buf = Buffer.from(url.split(",")[1], "base64");
      writeFileSync(join(PUBLIC, `dusk-raft-${theme}-${width}.webp`), buf);
      log(`poster dusk-raft-${theme}-${width}.webp · ${(buf.length / 1024).toFixed(0)} KB`);
      await ctx.close();
    }
}

// ------------------------------------------------------------------------------------------------ shots
if (on("shots")) {
  for (const theme of ["dark", "light"] as const)
    for (const width of [1440, 390]) {
      const { ctx, p, errors } = await open(width, theme);
      await act(p, width);
      await p.mouse.move(-1, -1).catch(() => {});
      await sleep(400);
      await p.screenshot({ path: join(OUT, `${theme}-${width}.png`) });
      await p.screenshot({ path: join(OUT, `${theme}-${width}-full.png`), fullPage: true });
      log(`shot ${theme}-${width}.png${errors.length ? " · ERR " + errors.join(" | ") : ""}`);
      await ctx.close();
    }
}

// ------------------------------------------------------------------------------------------------ contrast
if (on("contrast")) {
  for (const theme of ["dark", "light"] as const)
    for (const width of [1440, 390]) {
      const { ctx, p } = await open(width, theme);
      await act(p, width);
      const worst: Record<string, { min: number; need: number }> = {};
      for (let k = 0; k < 3; k++) {
        const r = await p.evaluate(async () => {
          const url = (window as any).__hero.snapshot("image/png");
          const img = await new Promise<HTMLImageElement>((res) => {
            const i = new Image();
            i.onload = () => res(i);
            i.src = url;
          });
          const cv = new OffscreenCanvas(img.width, img.height);
          const g = cv.getContext("2d")!;
          g.drawImage(img, 0, 0);
          const cr = document.querySelector(".hero-canvas")!.getBoundingClientRect(),
            sx = img.width / cr.width,
            sy = img.height / cr.height;
          const lin = (c: number) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          const Y = (r: number, gg: number, bb: number) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(bb);
          const colorY = (css: string) => {
            const t = new OffscreenCanvas(1, 1).getContext("2d")!;
            t.fillStyle = css;
            t.fillRect(0, 0, 1, 1);
            const d = t.getImageData(0, 0, 1, 1).data;
            return Y(d[0], d[1], d[2]);
          };
          const ratio = (a: number, bb: number) => (Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05);
          // every text run's own box (per line), with its own colour
          const runs: [string, Element, number, DOMRect[]][] = [];
          const add = (name: string, el: Element | null, need: number) => {
            if (!el) return;
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) {
              if (!n.textContent?.trim()) continue;
              const rg = document.createRange();
              rg.selectNodeContents(n);
              runs.push([name, n.parentElement!, need, [...rg.getClientRects()]]);
            }
          };
          add("headline", document.querySelector(".hero h1"), 3);
          add("lede", document.querySelector(".hero .lede"), 4.5);
          for (const a of document.querySelectorAll(".nav .brand .word, .nav .links a"))
            if ((a as HTMLElement).offsetParent) add("nav", a, 4.5);
          const out: Record<string, { min: number; need: number }> = {};
          for (const [name, el, need, boxes] of runs) {
            const ty = colorY(getComputedStyle(el).color);
            for (const bx of boxes) {
              const x0 = Math.max(0, Math.floor((bx.left - cr.left) * sx)),
                y0 = Math.max(0, Math.floor((bx.top - cr.top) * sy));
              const w = Math.max(1, Math.floor(bx.width * sx)),
                h = Math.max(1, Math.floor(bx.height * sy));
              const px = g.getImageData(x0, y0, w, h).data;
              let min = Infinity;
              for (let i = 0; i < px.length; i += 4) min = Math.min(min, ratio(ty, Y(px[i], px[i + 1], px[i + 2])));
              if (!out[name] || min < out[name].min) out[name] = { min, need };
            }
          }
          return out;
        });
        for (const [k2, v] of Object.entries(r)) if (!worst[k2] || v.min < worst[k2].min) worst[k2] = v;
        await sleep(1300);
      }
      const fails = Object.values(worst).some((v) => v.min < v.need);
      log(
        `contrast ${theme}-${width}: ` +
          Object.entries(worst)
            .map(([k2, v]) => `${k2} ${v.min.toFixed(2)}:1 ${v.min >= v.need ? "ok" : "FAIL (needs " + v.need + ")"}`)
            .join(" · ") +
          (fails ? "  <-- FAIL" : ""),
      );
      await ctx.close();
    }
}

// ------------------------------------------------------------------------------------------------ hand-off
if (on("handoff")) {
  const probe = async (p: Page) => {
    await p.addInitScript(() => {
      requestAnimationFrame(() => {
        const i = document.querySelector<HTMLImageElement>(".hero-poster");
        (window as any).__firstPaint = {
          poster: !!(i && i.complete && i.naturalWidth > 0 && i.src.startsWith("data:")),
          exact: document.documentElement.classList.contains("dusk-exact"),
        };
      });
      // the first live frame, read back right after it is submitted (before anything else moves)
      const iv = setInterval(() => {
        const h = (window as any).__hero;
        if (!h) return;
        clearInterval(iv);
        if (h.backend === "webgpu") {
          const s = h.getState();
          (window as any).__firstState = s;
          (window as any).__firstSnap = h.snapshot("image/png");
        }
      }, 0);
    });
  };
  const compare = (p: Page, before: string) =>
    p.evaluate(async (before) => {
      const load = (u: string) =>
        new Promise<HTMLImageElement>((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = u;
        });
      const [a, c] = await Promise.all([load(before), load((window as any).__firstSnap)]);
      const px = (img: HTMLImageElement) => {
        const cv = new OffscreenCanvas(img.width, img.height);
        const g = cv.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const A = px(a),
        C = px(c);
      let max = 0,
        over2 = 0;
      if (A.length === C.length)
        for (let i = 0; i < A.length; i += 4)
          for (let k = 0; k < 3; k++) {
            const dd = Math.abs(A[i + k] - C[i + k]);
            max = Math.max(max, dd);
            if (dd > 2) over2++;
          }
      return {
        size: `${a.width}×${a.height} vs ${c.width}×${c.height}`,
        max: A.length === C.length ? max : -1,
        over2,
        first: (window as any).__firstPaint,
      };
    }, before);

  for (const theme of ["dark", "light"] as const) {
    const { ctx, p, errors } = await open(1440, theme);
    await act(p, 1440);
    await probe(p);
    // the last frame the old page draws is the snapshot pageswap stores; read it the same way
    await p.evaluate(() => {
      addEventListener("pageswap", () => {
        const h = JSON.parse(sessionStorage.getItem("dusk:handoff")!);
        sessionStorage.setItem("probe:before", h.snap);
      });
    });
    await p.evaluate(() => document.querySelector<HTMLAnchorElement>(".nav .brand")!.click());
    await p.waitForFunction(() => (window as any).__firstSnap !== undefined, null, { timeout: 20000 });
    // the live first frame vs the poster the first paint showed (the stored last frame)
    const before = await p.evaluate(() => document.querySelector<HTMLImageElement>(".hero-poster")!.src);
    const res = await compare(p, before);
    // and the exact state: time and springs carried over
    const st = await p.evaluate(() => {
      const s = (window as any).__firstState;
      return { t: s.time.toFixed(3), camera: s.camera };
    });
    log(
      `handoff ${theme} raft→raft: ${res.size} · max channel diff vs the stored frame ${res.max} · ${res.over2} channels > 2 · first paint shows the stored frame: ${res.first?.poster} (exact: ${res.first?.exact}) · state t=${st.t} ${st.camera}${errors.length ? " · ERR " + errors.join(" | ") : ""}`,
    );
    await ctx.close();
  }
  // pixel-exact check without the WebP: store a PNG of the state the old page leaves, restore it, compare
  {
    const { ctx, p } = await open(1440, "dark");
    await act(p, 1440);
    const png = await p.evaluate(() => {
      const h = (window as any).__hero;
      h.pause();
      const png = h.snapshot("image/png");
      const s = h.getState();
      const r = document.querySelector(".hero-canvas")!.getBoundingClientRect();
      sessionStorage.setItem(
        "dusk:handoff",
        JSON.stringify({
          v: 3,
          at: Date.now(),
          w: innerWidth,
          h: innerHeight,
          cw: r.width,
          ch: r.height,
          theme: "dark",
          camera: s.camera,
          state: s,
          snap: png,
        }),
      );
      return png;
    });
    await probe(p);
    await p.evaluate(() => {
      addEventListener("pageswap", (e) => e.stopImmediatePropagation(), { capture: true });
      addEventListener("pagehide", (e) => e.stopImmediatePropagation(), { capture: true });
    });
    await p.reload();
    await p.waitForFunction(() => (window as any).__firstSnap !== undefined, null, { timeout: 20000 });
    const res = await compare(p, png);
    log(
      `handoff pixel-exact (PNG): ${res.size} · max channel diff ${res.max} · ${res.over2} channels > 2 · first paint shows it: ${res.first?.poster} (exact: ${res.first?.exact})`,
    );
    await ctx.close();
  }
  // from another camera (sproutboat.com's wide): the first frame is the wide picture, then the camera glides to raft
  {
    const { ctx, p } = await open(1440, "dark");
    const png = await p.evaluate(() => {
      const h = (window as any).__hero;
      h.setCamera("wide", { animate: false });
      h.pause();
      const png = h.snapshot("image/png");
      const s = h.getState();
      const r = document.querySelector(".hero-canvas")!.getBoundingClientRect();
      sessionStorage.setItem(
        "dusk:handoff",
        JSON.stringify({
          v: 3,
          at: Date.now(),
          w: innerWidth,
          h: innerHeight,
          cw: r.width,
          ch: r.height,
          theme: "dark",
          camera: s.camera,
          state: s,
          snap: png,
        }),
      );
      return png;
    });
    await probe(p);
    await p.evaluate(() => {
      addEventListener("pageswap", (e) => e.stopImmediatePropagation(), { capture: true });
      addEventListener("pagehide", (e) => e.stopImmediatePropagation(), { capture: true });
    });
    await p.reload();
    await p.waitForFunction(() => (window as any).__firstSnap !== undefined, null, { timeout: 20000 });
    const res = await compare(p, png);
    const t0 = Date.now();
    await p.waitForFunction(
      () => {
        const s = (window as any).__hero.getState().springs;
        return Math.abs(s["cam:raft"][0] - 1) < 1e-3 && Math.abs(s["cam:wide"][0]) < 1e-3;
      },
      null,
      { timeout: 5000, polling: 16 },
    );
    log(
      `handoff wide→raft: first frame vs the wide frame: max channel diff ${res.max} · first paint shows it: ${res.first?.poster} · glide settled in ~${Date.now() - t0} ms`,
    );
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ reduced motion
if (on("reduced")) {
  const { ctx, p, errors } = await open(1440, "dark", { reduced: true });
  await sleep(800);
  const r = await p.evaluate(async () => {
    const h = (window as any).__hero;
    const a = h.gpuHist.length;
    await new Promise((r) => setTimeout(r, 800));
    return { running: h.running(), timed: h.gpuHist.length - a };
  });
  await p.mouse.click(400, 820);
  await sleep(400);
  const r2 = await p.evaluate(() => ({
    running: (window as any).__hero.running(),
    swells: (window as any).__hero.getState().swells.length,
  }));
  const cut = await p.evaluate(() => {
    const h = (window as any).__hero;
    h.setCamera("wide");
    const s = h.getState().springs;
    return s["cam:wide"][0] === 1 && s["cam:raft"][0] === 0;
  });
  await p.evaluate(() => (window as any).__hero.setCamera("raft"));
  await p.screenshot({ path: join(OUT, "reduced-dark-1440.png") });
  log(
    `reduced motion: rAF loop ${r.running ? "RUNNING" : "off"}, ${r.timed} timed frames in 0.8 s; after a press on the sea: loop ${r2.running ? "RUNNING" : "off"}, ${r2.swells} swells; setCamera cuts: ${cut}${errors.length ? " · ERR " + errors.join(" | ") : ""}`,
  );
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ no WebGPU
if (on("static")) {
  for (const theme of ["dark", "light"] as const) {
    const { ctx, p, errors } = await open(1440, theme, { noGpu: true });
    await sleep(500);
    const r = await p.evaluate(() => {
      const i = document.querySelector<HTMLImageElement>(".hero-poster")!,
        c = document.querySelector<HTMLCanvasElement>(".hero-canvas")!;
      return {
        backend: document.querySelector<HTMLElement>("[data-hero-shell]")!.dataset.backend,
        poster: i.complete && i.naturalWidth > 0 ? i.src.split("/").pop() : "none",
        canvas: getComputedStyle(c).display,
      };
    });
    await p.screenshot({ path: join(OUT, `static-${theme}-1440.png`) });
    log(
      `no WebGPU ${theme}: backend ${r.backend} · poster ${r.poster} · canvas display ${r.canvas}${errors.length ? " · ERR " + errors.join(" | ") : ""}`,
    );
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ perf
if (on("perf")) {
  for (const width of [1440, 390]) {
    const { ctx, p } = await open(width, "dark", { dpr: width === 390 ? 3 : 1 });
    const n0 = await p.evaluate(() => (window as any).__hero.gpuHist.length);
    await act(p, width);
    const raw = await p.evaluate((n0) => {
      const h = (window as any).__hero.gpuHist.slice(n0).sort((a: number, b: number) => a - b);
      return { med: h[h.length >> 1], p90: h[Math.floor(h.length * 0.9)], n: h.length };
    }, n0);
    const size = await p.evaluate(() => {
      const c = document.querySelector("canvas")!;
      return `${c.width}×${c.height}`;
    });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(400);
    const off = await p.evaluate(async () => {
      const h = (window as any).__hero;
      const a = h.gpuHist.length;
      await new Promise((r) => setTimeout(r, 700));
      return { running: h.running(), frames: h.gpuHist.length - a };
    });
    await ctx.close();
    const runs: number[] = [];
    for (let k = 0; k < 2; k++) {
      const c2 = await open(width, "dark", { q: "?bench=10", dpr: width === 390 ? 3 : 1 });
      const m0 = await c2.p.evaluate(() => (window as any).__hero.gpuHist.length);
      await act(c2.p, width);
      runs.push(
        await c2.p.evaluate((m0) => {
          const h = (window as any).__hero.gpuHist.slice(m0).sort((a: number, b: number) => a - b);
          return h[h.length >> 1];
        }, m0),
      );
      await c2.ctx.close();
    }
    log(
      `perf ${width}: canvas ${size} · full-clock cost ${runs.map((x) => x.toFixed(2)).join(" / ")} ms (budget ${width === 390 ? 2 : 5}) · raw pass median ${raw.med?.toFixed(2)} p90 ${raw.p90?.toFixed(2)} ms (${raw.n} frames) · off-screen: ${off.frames} frames in 0.7 s, loop ${off.running ? "RUNNING" : "stopped"}`,
    );
  }
}

// ------------------------------------------------------------------------------------------------ recordings
if (on("rec")) {
  const TMP = join(OUT, ".rec");
  const take = async (name: string, fn: (p: Page) => Promise<void>) => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP);
    const { ctx, p } = await open(1440, "dark", { video: TMP, dpr: 1 });
    await fn(p);
    await ctx.close();
    const f = readdirSync(TMP).find((x) => x.endsWith(".webm"))!;
    renameSync(join(TMP, f), join(OUT, name));
    rmSync(TMP, { recursive: true, force: true });
    log(`rec ${name}`);
  };
  await take("hero-interaction.webm", async (p) => {
    await act(p, 1440);
    await sweep(p, 1400, 900, 420, 260, 90);
    await p.evaluate(() => document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!.click());
    await p.mouse.click(1440 * 0.42, 900 * 0.92);
    await sleep(3000);
  });
  await take("hero-glide.webm", async (p) => {
    await sleep(800);
    for (const c of ["wide", "sky", "raft", "wide", "raft"]) {
      await p.evaluate((c) => (window as any).__hero.setCamera(c), c);
      await sleep(1300);
    }
  });
}

await b.close();
writeFileSync(join(OUT, `verify-${what}.log`), report.join("\n") + "\n");
