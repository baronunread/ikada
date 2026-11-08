/**
 * What the site knows about ikada, read at build time from the registry that
 * scripts/registry.ts generated out of ../src. Pages never keep their own component list.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// A module import, not a file read, so the dev server reloads when `bun run registry` rewrites it.
import registry from "../../.registry/registry.json";

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

/** Every registry item; run `bun run registry` first if .registry/registry.json is missing. */
export const items: Item[] = registry.items as Item[];

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

const exportsComponent = (source: string): boolean => /export function [A-Z]\w*\s*[(<]/.test(source);

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

/** The blocks the website shows: a dashboard overview, a live log view and a settings form. The other blocks stay in the
 *  repo and the registry but have no page, link or search entry here. */
export const SHOWN_BLOCKS = ["metric-row", "logs-panel", "settings-section"];

/** The shown dashboard blocks (registry:block), one page each under /blocks. */
export const blocks = items
  .filter((i) => i.type === "registry:block" && SHOWN_BLOCKS.includes(i.name))
  .sort((a, b) => a.title.localeCompare(b.title));

/** The installed source of a block's files, as `shadcn add` writes them (aliases rewritten). */
export function blockFiles(item: Item): { name: string; source: string }[] {
  return (item.files ?? []).map((f) => ({
    name: f.path.split("/").pop() ?? f.path,
    source: readFileSync(join(siteDir, ".registry", f.path), "utf8"),
  }));
}
