/**
 * The docs chrome's data, computed at build time: the navigation, page order for the pager,
 * gzipped file sizes, the install commands for each package manager, and the markdown that
 * "Copy page for AI" puts on the clipboard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { blocks, components, items, REGISTRY_URL, REPO_URL, siteDir } from "./registry";
import type { Item } from "./registry";

export const VERSION: string = JSON.parse(readFileSync(join(siteDir, "..", "package.json"), "utf8")).version;
export const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const href = (path: string): string => `${base}${path}`;

export interface NavLink {
  href: string;
  label: string;
  badge?: string;
}
export interface NavGroup {
  heading: string;
  links: NavLink[];
}

export const guides: NavLink[] = [
  { href: href("/docs"), label: "Overview" },
  { href: href("/installation"), label: "Installation" },
  { href: href("/tailwind"), label: "Tailwind v4 setup" },
  { href: href("/theming"), label: "Theming and tokens" },
  { href: href("/motion"), label: "Motion", badge: "Afloat" },
  { href: href("/changelog"), label: "Changelog" },
];

export const sideNav: NavGroup[] = [
  { heading: "Get started", links: guides },
  {
    heading: "Blocks",
    links: [
      { href: href("/blocks"), label: "All blocks" },
      ...blocks.map((b) => ({ href: href(`/blocks/${b.name}`), label: b.title })),
    ],
  },
  { heading: "Components", links: components.map((c) => ({ href: href(`/components/${c.name}`), label: c.title })) },
];

/** The header's links. `match` decides which one is current for a path. */
export const topNav = [
  { href: href("/docs"), label: "Docs", match: (p: string) => /\/(docs|installation|theming|changelog)$/.test(p) },
  { href: href("/docs#components"), label: "Components", match: (p: string) => p.includes("/components/") },
  { href: href("/blocks"), label: "Blocks", match: (p: string) => /\/blocks(\/|$)/.test(p) },
  { href: href("/motion"), label: "Motion", match: (p: string) => p.endsWith("/motion") },
];

/** Previous and next page in sidebar order, within the same group. */
export function pager(current: string): { prev?: NavLink; next?: NavLink } {
  for (const g of sideNav) {
    const i = g.links.findIndex((l) => l.href === current);
    if (i >= 0) return { prev: g.links[i - 1], next: g.links[i + 1] };
  }
  return {};
}

/** The installed source of every file of an item, as `shadcn add` writes them. */
export function itemSources(item: Item): string[] {
  return (item.files ?? []).map((f) => readFileSync(join(siteDir, ".registry", f.path), "utf8"));
}

/** Gzipped size of an item's files, the way Deck's index reports it: "2.1 kB". */
export function gzipKb(item: Item): string {
  const bytes = itemSources(item).reduce((sum, s) => sum + gzipSync(s, { level: 9 }).length, 0);
  return `${(bytes / 1000).toFixed(1)} kB`;
}

export const usesBaseUi = (item: Item): boolean =>
  (item.dependencies ?? []).some((d) => d.startsWith("@base-ui/react"));

export const registryJson = (name: string): string => href(`/r/${name}.json`);
export const registryUrl = (name: string): string => `${REGISTRY_URL}/${name}.json`;

/** shadcn's own commands for each package manager. */
export const PMS = ["npm", "pnpm", "bun", "yarn"] as const;
export type Pm = (typeof PMS)[number];
export function addCommands(names: string | string[]): Record<Pm, string> {
  const args = (Array.isArray(names) ? names : [names])
    .map((n) => (n.startsWith("http") || n.startsWith("@") ? n : registryUrl(n)))
    .join(" ");
  return {
    npm: `npx shadcn@latest add ${args}`,
    pnpm: `pnpm dlx shadcn@latest add ${args}`,
    bun: `bunx --bun shadcn@latest add ${args}`,
    yarn: `yarn shadcn@latest add ${args}`,
  };
}

export const sourceUrl = (repoPath: string): string => `${REPO_URL}/blob/main/${repoPath}`;
export const treeUrl = (repoPath: string): string => `${REPO_URL}/tree/main/${repoPath}`;

/** The registry entries an item pulls in that have their own docs page. */
export function pagedDeps(item: Item): Item[] {
  const byName = new Map(items.map((i) => [i.name, i]));
  const paged = new Set(components.map((c) => c.name));
  return (item.registryDependencies ?? [])
    .map((d) =>
      byName.get(
        d
          .split("/")
          .pop()
          ?.replace(/\.json$/, "") ?? "",
      ),
    )
    .filter((i): i is Item => Boolean(i && paged.has(i.name)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export interface TocEntry {
  id: string;
  label: string;
  sub?: boolean;
}

/** Markdown for "Copy page for AI": the page's facts in a form a model reads well. */
export function pageMarkdown(parts: { title: string; description?: string; url: string; body: string[] }): string {
  return [
    `# ${parts.title}`,
    "",
    parts.description ?? "",
    "",
    `Source page: https://sproutboat.com${parts.url}`,
    "",
    ...parts.body,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const fence = (code: string, lang = "tsx"): string => `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
