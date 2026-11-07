// node shot.mjs <cam> <theme> <width> <out.png> [query] — a still of the mock page (reduced = one deterministic frame)
import { chromium } from "/Users/andreabruno/.agents/skills/screenshot-capture/scripts/node_modules/playwright-core/index.mjs";
const [cam = "wide", theme = "dark", width = "1440", out = "/tmp/shot.png", extra = "reduced=1"] = process.argv.slice(2);
const W = +width, H = W <= 600 ? 844 : 900;
const b = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W <= 600 ? 2 : 1, colorScheme: theme, isMobile: W <= 600, hasTouch: W <= 600 });
const p = await ctx.newPage();
const logs = []; p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.text().slice(0, 600)); }); p.on("pageerror", (e) => logs.push("pageerror: " + e.message));
await p.goto(`http://127.0.0.1:4466/?cam=${cam}&theme=${theme}&${extra}`, { waitUntil: "load" });
await p.waitForFunction(() => window.__dusk, null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(extra.includes("reduced=1") ? 1200 : 3500);
const info = await p.evaluate(() => ({ backend: document.body.dataset.backend, stat: document.querySelector("#stat")?.textContent }));
await p.screenshot({ path: out });
console.log(JSON.stringify({ out, ...info, logs }));
await b.close();
