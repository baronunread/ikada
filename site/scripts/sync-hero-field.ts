/**
 * Copies the hero field (the Growth shader, TypeGPU + WebGL2) from the mockup it was designed in,
 * so a newer version drops in without touching the site's own glue (src/hero-field/load.ts, hero.ts):
 *   bun scripts/sync-hero-field.ts ../../mockups-20261104/ikada-site-premium/specimen-shader/src
 * The files are copied verbatim; the site only depends on the Handle in common.ts.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const from = resolve(process.argv[2] ?? "");
const to = join(import.meta.dir, "../src/hero-field");
const files = ["common.ts", "hero-webgpu.ts", "hero-webgl.ts", "palette.ts", "mask.ts"];
for (const f of files) {
  if (!existsSync(join(from, f))) throw new Error(`${f} is missing in ${from}`);
  copyFileSync(join(from, f), join(to, f));
  console.log(`hero-field/${f}`);
}
