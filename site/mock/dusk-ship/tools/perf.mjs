// node perf.mjs <port> [dpr] — median raw single-pass GPU time (timestamp queries, ?bench=N passes) per camera/theme/size.
import { chromium } from "/Users/andreabruno/.agents/skills/screenshot-capture/scripts/node_modules/playwright-core/index.mjs";
const port = process.argv[2] ?? "4466", dprArg = process.argv[3];
const b = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU", "--enable-dawn-features=allow_unsafe_apis"] });
const rows = [];
for (const [W, H, dpr] of [[1440, 900, 1], [390, 844, 2]]) for (const theme of ["dark", "light"]) for (const cam of ["wide", "raft", "sky"]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dprArg ? +dprArg : dpr, isMobile: W < 600 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/?cam=${cam}&theme=${theme}&adaptive=0&bench=4&dpr=${W < 600 ? 2 : 1}&ui=0&overlay=0&fps=60`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__dusk, null, { timeout: 15000 });
  await p.waitForTimeout(4500);
  const r = await p.evaluate(() => { const h = window.__dusk.gpuHist.slice(-120).sort((a, b) => a - b); const c = document.querySelector("canvas"); return { n: h.length, med: h[h.length >> 1], p95: h[Math.floor(h.length * 0.95)], w: c.width, h: c.height }; });
  rows.push({ W, theme, cam, ...r }); console.log(JSON.stringify({ W, theme, cam, med: r.med?.toFixed(2), p95: r.p95?.toFixed(2), n: r.n, px: r.w + "x" + r.h }));
  await ctx.close();
}
await b.close();
