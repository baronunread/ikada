/**
 * Vendors Raft at dusk into another site (sproutboat.com, its docs). The source of truth is this folder:
 * site/src/hero/dusk/. From the other repo:
 *   bun <ikada>/site/scripts/sync-dusk.ts web/src/hero/dusk          copy, and stamp the version and commit
 *   bun <ikada>/site/scripts/sync-dusk.ts web/src/hero/dusk --check  exit 1 if the copy differs from the source
 * The copy is verbatim plus a VENDORED file; edit the source here and sync, never the copy.
 */
import { $ } from "bun";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FILES = ["index.ts", "scene.ts", "shader.ts", "gpu.ts", "handoff.ts", "README.md"];
const src = join(import.meta.dir, "../src/hero/dusk");
const dest = process.argv[2] ? resolve(process.argv[2]) : "";
if (!dest) {
  console.error("usage: bun sync-dusk.ts <destination folder> [--check]");
  process.exit(2);
}
const version = /DUSK_VERSION = ["']([^"']+)["']/.exec(readFileSync(join(src, "index.ts"), "utf8"))?.[1] ?? "?";

if (process.argv.includes("--check")) {
  const stale = FILES.filter(
    (f) => !existsSync(join(dest, f)) || readFileSync(join(dest, f), "utf8") !== readFileSync(join(src, f), "utf8"),
  );
  if (stale.length) {
    console.error(`dusk ${version}: ${dest} differs in ${stale.join(", ")}; run without --check to update`);
    process.exit(1);
  }
  console.log(`dusk ${version}: ${dest} is up to date`);
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
  `Raft at dusk ${version}, copied from baronunread/ikada site/src/hero/dusk at ${commit}${dirty}.\n` +
    `Do not edit here: change the source in ikada and run site/scripts/sync-dusk.ts.\n`,
);
console.log(`dusk ${version} (${commit}${dirty}) -> ${dest}: ${FILES.join(", ")}, VENDORED`);
