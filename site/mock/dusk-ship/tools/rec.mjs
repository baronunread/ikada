// node rec.mjs <theme> <out.webm> [width] — records wide -> raft -> wide on the mock page (overlay on, controls hidden)
import { chromium } from "/Users/andreabruno/.agents/skills/screenshot-capture/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync, renameSync, rmSync } from "node:fs";
const [theme = "dark", out = "/tmp/glide.webm", width = "1440"] = process.argv.slice(2);
const W = +width, H = W < 600 ? 844 : 900, tmp = "/tmp/shipwork/vid";
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme, recordVideo: { dir: tmp, size: { width: W, height: H } } });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:4466/?cam=wide&theme=${theme}&overlay=1&ui=0`, { waitUntil: "load" });
await p.waitForFunction(() => window.__dusk && window.__cam);
await p.waitForTimeout(2500);
await p.evaluate(() => window.__cam("raft")); await p.waitForTimeout(3200);
await p.evaluate(() => window.__cam("wide")); await p.waitForTimeout(2800);
const v = p.video(); await ctx.close(); renameSync(await v.path(), out); await b.close(); console.log(out);
