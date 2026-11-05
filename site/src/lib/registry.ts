/**
 * What the site knows about ikada, read at build time from the registry that
 * scripts/registry.ts generated out of ../src. Pages never keep their own component list.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Item {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: { path: string; type: string }[];
}

/** The site package directory; Astro runs builds and the dev server from here. */
export const siteDir = process.cwd();
/** ikada's source, one level up from the site. */
export const srcDir = join(siteDir, "..", "src");

const registryPath = join(siteDir, ".registry", "registry.json");
if (!existsSync(registryPath))
  throw new Error("Run `bun run registry` first: .registry/registry.json is missing.");

export const items: Item[] = JSON.parse(readFileSync(registryPath, "utf8")).items;

/** Where a ui item's source lives under src/. */
export function sourcePath(item: Item): string {
  if (item.name === "chart-theme") return join(srcDir, "charts", "theme.ts");
  for (const dir of ["components", "charts"]) {
    for (const ext of [".tsx", ".ts"]) {
      const p = join(srcDir, dir, `${item.name}${ext}`);
      if (existsSync(p)) return p;
    }
  }
  return "";
}

const exportsComponent = (source: string): boolean =>
  /export function [A-Z]\w*\s*[(<]/.test(source);

/** One docs page per ui file that exports a React component (helpers like status.ts get none). */
export const components = items
  .filter((i) => i.type === "registry:ui")
  .filter((i) => {
    const p = sourcePath(i);
    return p !== "" && exportsComponent(readFileSync(p, "utf8"));
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const REGISTRY_URL = "https://sproutboat.com/ikada/r";
export const REPO_URL = "https://github.com/baronunread/ikada";
