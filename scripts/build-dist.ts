/**
 * Builds the npm package: `dist/` is compiled ESM with one file per source module (so bundlers
 * tree-shake per component), `.d.ts` with declaration maps, `"use client"` kept as the first
 * statement of every client file, and a `theme.css` that points Tailwind at the compiled files.
 *
 *   bun scripts/build-dist.ts            build dist/ and check package.json `exports`
 *   bun scripts/build-dist.ts --exports  rewrite package.json `exports` from src/components
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

/** Source modules that are helpers, not importable components. */
const INTERNAL = new Set(["status", "toast-api"]);

/** The `exports` map: types first, one subpath per component, the barrel, charts, tokens, CSS. */
export function exportsMap(): Record<string, unknown> {
  const entry = (path: string) => ({ types: `./dist/${path}.d.ts`, default: `./dist/${path}.js` });
  const components = readdirSync(join(root, "src/components"))
    .filter((f) => f.endsWith(".tsx") && !INTERNAL.has(f.replace(/\.tsx$/, "")))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
  return {
    ".": entry("index"),
    ...Object.fromEntries(components.map((name) => [`./${name}`, entry(`components/${name}`)])),
    "./charts": entry("charts/index"),
    "./tokens": entry("tokens.generated"),
    "./theme.css": "./dist/theme.css",
    "./package.json": "./package.json",
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Node ESM needs real file names: `./cn` becomes `./cn.js` (or `./charts/index.js`). */
function withExtensions(file: string, code: string): string {
  const fix = (spec: string): string => {
    if (!spec.startsWith(".") || /\.(js|css|json)$/.test(spec)) return spec;
    const target = resolve(dirname(file), spec);
    return existsSync(`${target}.js`) ? `${spec}.js` : existsSync(join(target, "index.js")) ? `${spec}/index.js` : spec;
  };
  return code.replace(/(\bfrom\s*|\bimport\s*\(?\s*|\bimport\("?)(["'])(\.{1,2}\/[^"']+)\2/g, (_m, lead, q, spec) => {
    return `${lead}${q}${fix(spec)}${q}`;
  });
}

function build(): void {
  rmSync(dist, { recursive: true, force: true });
  const tsc = spawnSync("bunx", ["tsc", "-p", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });
  if (tsc.status !== 0) process.exit(tsc.status ?? 1);
  for (const file of walk(dist)) {
    if (!/\.(js|d\.ts)$/.test(file)) continue;
    let code = readFileSync(file, "utf8");
    code = withExtensions(file.replace(/\.d\.ts$/, ".js"), code);
    // Module-level tv() calls are pure: an unused style function is dropped with its module.
    if (file.endsWith(".js")) code = code.replace(/^((?:export )?const \w+ = )(tv\()/gm, "$1/* @__PURE__ */ $2");
    writeFileSync(file, code);
  }
  // The theme, plus a @source so Tailwind scans the compiled components (it skips node_modules otherwise).
  const theme = readFileSync(join(root, "src/theme.css"), "utf8");
  writeFileSync(
    join(dist, "theme.css"),
    `${theme}\n/* Tailwind skips node_modules: scan the compiled components so their utilities are generated. */\n@source "./**/*.js";\n`,
  );
  console.log(`built ${relative(root, dist)}/: ${walk(dist).length} files`);
}

if (import.meta.main) {
  if (process.argv.includes("--exports")) {
    const path = join(root, "package.json");
    const json = JSON.parse(readFileSync(path, "utf8"));
    json.exports = exportsMap();
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`wrote ${Object.keys(json.exports).length} exports`);
  } else {
    if (JSON.stringify(exportsMap()) !== JSON.stringify(pkg.exports)) {
      console.error("package.json exports are stale: run `bun scripts/build-dist.ts --exports`");
      process.exit(1);
    }
    build();
  }
}
