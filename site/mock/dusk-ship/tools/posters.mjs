// node posters.mjs <outdir> — the no-WebGPU poster stills: one deterministic frame per camera x theme x size, with the
// contrast mask of that camera's copy but without the copy. outdir/dusk-{cam}-{theme}-{390|1440}.webp
import { chromium } from "/Users/andreabruno/.agents/skills/screenshot-capture/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.argv[2] ?? "/tmp/posters";
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan,WebGPU"] });
for (const cam of ["wide", "raft", "sky"]) for (const theme of ["dark", "light"]) for (const [W, H] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme, isMobile: W < 600, hasTouch: W < 600 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:4466/?cam=${cam}&theme=${theme}&reduced=1&overlay=0&ui=0`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__dusk && document.body.dataset.backend === "webgpu", null, { timeout: 15000 });
  await p.waitForTimeout(1200);
  const png = await p.screenshot();
  const webp = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0); return c.toDataURL("image/webp", 0.82).split(",")[1];
  }, png.toString("base64"));
  writeFileSync(`${out}/dusk-${cam}-${theme}-${W}.webp`, Buffer.from(webp, "base64")); console.log(cam, theme, W);
  await ctx.close();
}
await b.close();
