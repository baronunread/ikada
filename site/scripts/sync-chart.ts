/**
 * Vendors the nautical chart into another site (sproutboat.com, its docs). The source of truth is this folder:
 * site/src/hero/chart/. From the other repo:
 *   bun <ikada>/site/scripts/sync-chart.ts web/src/hero/chart          copy, and stamp the version and commit
 *   bun <ikada>/site/scripts/sync-chart.ts web/src/hero/chart --check  exit 1 if the copy differs from the source
 * The copy is verbatim plus a VENDORED file; edit the source here and sync, never the copy.
 */
import { $ } from "bun";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FILES = [
  "index.ts",
  "scene.ts",
  "world.ts",
  "palette.ts",
  "cameras.ts",
  "handoff.ts",
  "instrument-serif-italic.woff2",
  "README.md",
];
const src = join(import.meta.dir, "../src/hero/chart");
const dest = process.argv[2] ? resolve(process.argv[2]) : "";
if (!dest) {
  console.error("usage: bun sync-chart.ts <destination folder> [--check]");
  process.exit(2);
}
const version = /CHART_VERSION = ["']([^"']+)["']/.exec(readFileSync(join(src, "index.ts"), "utf8"))?.[1] ?? "?";
const same = (f: string): boolean =>
  existsSync(join(dest, f)) && readFileSync(join(dest, f)).equals(readFileSync(join(src, f)));

if (process.argv.includes("--check")) {
  const stale = FILES.filter((f) => !same(f));
  if (stale.length) {
    console.error(`chart ${version}: ${dest} differs in ${stale.join(", ")}; run without --check to update`);
    process.exit(1);
  }
  console.log(`chart ${version}: ${dest} is up to date`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of FILES) copyFileSync(join(src, f), join(dest, f));
const commit = (await $`git -C ${src} rev-parse --short HEAD`.quiet().nothrow()).stdout.toString().trim() || "unknown";
const dirty = (await $`git -C ${src} status --porcelain -- .`.quiet().nothrow()).stdout.toString().trim()
  ? " (with uncommitted changes)"
  : "";
writeFileSync(
  join(dest, "VENDORED"),
  `Nautical chart ${version}, copied from baronunread/ikada site/src/hero/chart at ${commit}${dirty}.\n` +
    `Do not edit here: change the source in ikada and run site/scripts/sync-chart.ts.\n`,
);
console.log(`chart ${version} (${commit}${dirty}) -> ${dest}: ${FILES.join(", ")}, VENDORED`);
