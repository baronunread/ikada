// node perf1.mjs <port> <cam> <theme> <W> <query...> — one GPU median
import { chromium } from "/Users/andreabruno/.agents/skills/screenshot-capture/scripts/node_modules/playwright-core/index.mjs";
const [port, cam, theme, W, ...qs] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU"] });
for (const q of qs) {
  const ctx = await b.newContext({ viewport: { width: +W, height: +W < 600 ? 844 : 900 }, deviceScaleFactor: +W < 600 ? 2 : 1, isMobile: +W < 600 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/?cam=${cam}&theme=${theme}&adaptive=0&bench=${process.env.BENCH ?? 4}&dpr=${+W < 600 ? 2 : 1}&ui=0&overlay=0&${q}`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__dusk, null, { timeout: 15000 });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const h = window.__dusk.gpuHist.slice(-120).sort((a, b) => a - b); return h[h.length >> 1]; });
  console.log(q.padEnd(12), cam, theme, W, r?.toFixed(2));
  await ctx.close();
}
await b.close();
