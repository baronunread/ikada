/**
 * Generates a shadcn registry from this package's source, so `npx shadcn add` installs the
 * same files the dashboards import. Nothing here is hand-kept: every file under src/components,
 * src/charts and src/lib becomes an item, imports are rewritten to the shadcn aliases, npm
 * dependencies come from package.json and the theme item comes from tokens/tokens.ts.
 *
 *   bun scripts/build-registry.ts --out <dir> [--url https://sproutboat.com/ikada/r]
 *
 * writes <dir>/registry.json and <dir>/registry/ikada/**. Then, from <dir>:
 *
 *   bunx shadcn build registry.json --output <public>/ikada/r
 *
 * Where files land in the user's project (with the default aliases):
 *   src/components/x.tsx, src/charts/x.tsx  ->  components/ui/x.tsx   (registry:ui)
 *   src/charts/theme.ts                     ->  components/ui/chart-theme.ts
 *   src/lib/x.ts                            ->  lib/ikada/x.ts        (registry:lib)
 *   src/tokens.generated.ts                 ->  lib/ikada/tokens.ts
 *   blocks/<name>/<file>.tsx                ->  components/<file>.tsx  (registry:block)
 *
 * A block is a copyable dashboard pattern: blocks/<name>/<name>.tsx exports a component named
 * after the folder that renders with no props (its defaults are sample data), built only from
 * ikada imports, which are rewritten here like any other file.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import {
  motionAtProperties,
  motionKeyframes,
  offsetProperties,
  reducedMotionProperties,
  springProperties,
} from "../tokens/generate";
import { colorNames, dark, density, fonts, light, motion, radius, shadow, typeScale, zIndex } from "../tokens/tokens";

const root = join(import.meta.dir, "..");
const src = join(root, "src");
const blocksDir = join(root, "blocks");
const STYLE = "ikada";

export interface RegistryFile {
  path: string;
  type: "registry:ui" | "registry:lib" | "registry:component";
}

export interface RegistryItem {
  name: string;
  type: "registry:ui" | "registry:lib" | "registry:theme" | "registry:item" | "registry:block";
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  css?: CssTree;
  categories?: string[];
}

/** A CSS block as shadcn reads it: selectors and at-rules nest, leaves are declarations. */
export interface CssTree {
  [selectorOrProperty: string]: string | CssTree;
}

interface SourceFile {
  /** Path under src/, posix, with extension: "components/button.tsx". */
  srcPath: string;
  item: string;
  type: "registry:ui" | "registry:lib";
  /** Path written under the output dir: "registry/ikada/ui/button.tsx". */
  outPath: string;
  /** Import specifier other files use for it: "@/components/ui/button". */
  alias: string;
}

const kebabToTitle = (s: string): string =>
  s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Every shippable source file, with where it goes and how others import it. */
export function sourceFiles(): SourceFile[] {
  const out: SourceFile[] = [];
  const list = (dir: string): string[] =>
    readdirSync(join(src, dir))
      .filter((f) => /\.tsx?$/.test(f) && !/^index\.tsx?$/.test(f))
      .sort();
  for (const dir of ["components", "charts"]) {
    for (const f of list(dir)) {
      const stem = f.replace(/\.tsx?$/, "");
      const ext = f.slice(stem.length);
      // charts/theme.ts would read as a site theme next to the other ui files.
      const item = dir === "charts" && stem === "theme" ? "chart-theme" : stem;
      out.push({
        srcPath: `${dir}/${f}`,
        item,
        type: "registry:ui",
        outPath: `registry/${STYLE}/ui/${item}${ext}`,
        alias: `@/components/ui/${item}`,
      });
    }
  }
  for (const f of list("lib")) {
    const stem = f.replace(/\.tsx?$/, "");
    out.push({
      srcPath: `lib/${f}`,
      item: stem,
      type: "registry:lib",
      outPath: `registry/${STYLE}/lib/${STYLE}/${f}`,
      alias: `@/lib/${STYLE}/${stem}`,
    });
  }
  out.push({
    srcPath: "tokens.generated.ts",
    item: "tokens",
    type: "registry:lib",
    outPath: `registry/${STYLE}/lib/${STYLE}/tokens.ts`,
    alias: `@/lib/${STYLE}/tokens`,
  });
  const names = new Set<string>();
  for (const f of out) {
    if (names.has(f.item)) throw new Error(`two source files map to the registry item "${f.item}"`);
    names.add(f.item);
  }
  return out;
}

/**
 * Module specifiers of static imports and re-exports (the clause between the keyword and
 * `from` holds only names, braces, commas and `*`, so prose like `from "Undone"` in a
 * comment never matches), side-effect imports and dynamic import().
 */
const IMPORT_RE =
  /(^[ \t]*(?:import|export)\b[\w\s{},*$]*?\bfrom\s*|^[ \t]*import\s*|\bimport\s*\(\s*)(["'])([^"'\n]+)\2/gm;

/** Package name of a bare specifier: "@base-ui/react/button" -> "@base-ui/react". */
const packageOf = (spec: string): string => {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? spec);
};

/** Peers the host app already has; never listed as item dependencies. */
const HOST_PACKAGES = new Set(["react", "react-dom", "tailwindcss"]);

interface Rewritten {
  content: string;
  local: string[];
  packages: string[];
}

/** Rewrites relative imports to shadcn aliases; collects local and npm dependencies. */
export function rewriteImports(file: SourceFile, content: string, bySrc: Map<string, SourceFile>): Rewritten {
  return rewriteWith(content, file.srcPath, (spec) => {
    const resolved = posix.normalize(posix.join(posix.dirname(file.srcPath), spec));
    const target = lookup(bySrc, resolved);
    return target && { alias: target.alias, item: target.item === file.item ? null : target.item };
  });
}

const lookup = (bySrc: Map<string, SourceFile>, resolved: string): SourceFile | undefined =>
  bySrc.get(`${resolved}.tsx`) ?? bySrc.get(`${resolved}.ts`) ?? bySrc.get(resolved);

/** The import rewrite: `map` turns a relative specifier into an alias and the item it depends on. */
function rewriteWith(
  content: string,
  where: string,
  map: (spec: string) => { alias: string; item: string | null } | undefined,
): Rewritten {
  const local = new Set<string>();
  const packages = new Set<string>();
  const next = content.replace(IMPORT_RE, (whole, lead: string, quote: string, spec: string) => {
    if (!spec.startsWith(".")) {
      const pkg = packageOf(spec);
      if (!HOST_PACKAGES.has(pkg)) packages.add(pkg);
      return whole;
    }
    const target = map(spec);
    if (!target) throw new Error(`${where}: cannot map import "${spec}" to a registry file`);
    if (target.item) local.add(target.item);
    return `${lead}${quote}${target.alias}${quote}`;
  });
  return { content: next, local: [...local].sort(), packages: [...packages].sort() };
}

export interface BlockSource {
  name: string;
  /** Files of the block, posix paths under the repo root, the main file first: "blocks/x/x.tsx". */
  files: string[];
}

/** Sentence case for block titles, keeping acronyms: "kv-browser" is "KV browser". */
const ACRONYMS = new Set(["kv", "d1", "r2", "sql", "api"]);
const TITLES: Record<string, string> = { "sign-in-card": "Sign-in card" };
export const blockTitle = (name: string): string =>
  TITLES[name] ??
  name
    .split("-")
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

/** Every block folder under blocks/, each with its main file `<name>.tsx`. */
export function blockSources(): BlockSource[] {
  let dirs: string[];
  try {
    dirs = readdirSync(blocksDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
  return dirs.map((name) => {
    const all = readdirSync(join(blocksDir, name))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .sort();
    if (!all.includes(`${name}.tsx`)) throw new Error(`blocks/${name} has no ${name}.tsx`);
    const rest = all.filter((f) => f !== `${name}.tsx`);
    return { name, files: [`${name}.tsx`, ...rest].map((f) => `blocks/${name}/${f}`) };
  });
}

/**
 * A block's files: imports of ikada (`../../src/...`) become the ui and lib aliases, imports of
 * a sibling file in the block become `@/components/<file>`, where shadcn puts it.
 */
function blockItem(
  block: BlockSource,
  bySrc: Map<string, SourceFile>,
  versions: Map<string, string>,
  ref: (item: string) => string,
  files: Map<string, string>,
): RegistryItem {
  const local = new Set<string>();
  const packages = new Set<string>();
  const out: RegistryFile[] = [];
  let description = "";
  for (const path of block.files) {
    const raw = readFileSync(join(root, path), "utf8");
    const rewritten = rewriteWith(raw, path, (spec) => {
      const resolved = posix.normalize(posix.join(posix.dirname(path), spec));
      if (resolved.startsWith("src/")) {
        const target = lookup(bySrc, resolved.slice(4));
        return target && { alias: target.alias, item: target.item };
      }
      const sibling = block.files.find((f) => f.replace(/\.tsx?$/, "") === resolved);
      return sibling ? { alias: `@/components/${posix.basename(resolved)}`, item: null } : undefined;
    });
    for (const l of rewritten.local) local.add(l);
    for (const p of rewritten.packages) packages.add(p);
    const outPath = `registry/${STYLE}/blocks/${block.name}/${posix.basename(path)}`;
    files.set(outPath, path.endsWith(".tsx") ? `"use client";\n\n${rewritten.content}` : rewritten.content);
    out.push({ path: outPath, type: "registry:component" });
    if (!description) description = describe(raw, block.name, "");
  }
  if (!description) throw new Error(`${block.files[0]}: describe the block in a JSDoc comment`);
  const dependencies = [...packages].sort().map((p) => {
    const version = versions.get(p);
    if (!version) throw new Error(`blocks/${block.name} imports "${p}", which is not in package.json dependencies`);
    return `${p}@${version}`;
  });
  const item: RegistryItem = {
    name: block.name,
    type: "registry:block",
    title: blockTitle(block.name),
    description,
    categories: ["dashboard"],
    registryDependencies: ["theme", ...[...local].sort()].map(ref),
    files: out,
  };
  if (dependencies.length) item.dependencies = dependencies;
  return item;
}

/** The first sentence of a JSDoc body, or null when it is too short to say anything. */
function firstSentence(raw: string): string | null {
  const doc = raw
    .replace(/^\s*\*\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^.+?[.!?](?=\s|$)/.exec(doc)?.[0] ?? doc;
  return sentence.length > 8 ? sentence : null;
}

/**
 * The module comment: the first JSDoc in the file, when it comes before the first export
 * (lib files and modules with no export named after the item, such as toast or chart-theme).
 */
function moduleDoc(content: string): string | null {
  const open = content.indexOf("/**");
  const firstExport = content.search(/^export /m);
  if (open < 0 || (firstExport >= 0 && open > firstExport)) return null;
  const close = content.indexOf("*/", open);
  return close < 0 ? null : firstSentence(content.slice(open + 3, close));
}

/**
 * The first sentence of the JSDoc above the file's main export, the one named after the item
 * (`dropdown-menu` is DropdownMenu), else the module comment, else the fallback.
 */
function describe(content: string, item: string, fallback: string): string {
  const name = item
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  const at = content.search(new RegExp(`\\nexport (?:function|const) ${name}\\b`));
  const before = at < 0 ? "" : content.slice(0, at).trimEnd();
  // Only a JSDoc that is the comment right above the export: a `/* banner */` there belongs to nobody.
  const open = before.lastIndexOf("/*");
  const main =
    before.endsWith("*/") && before.startsWith("/**", open) ? firstSentence(before.slice(open + 3, -2)) : null;
  return main ?? moduleDoc(content) ?? fallback;
}

const rem = (n: number): string => `${Number((n / 16).toFixed(4))}rem`;

/** The theme item: ikada's tokens as shadcn cssVars (light on :root, dark on .dark) plus base CSS. */
export function themeItem(): RegistryItem {
  const colors = (t: Record<string, string>): Record<string, string> =>
    Object.fromEntries(colorNames.map((n) => [`sb-${n}`, t[n] ?? ""]));
  const shadows = (mode: "dark" | "light"): Record<string, string> =>
    Object.fromEntries(Object.entries(shadow[mode]).map(([k, v]) => [`sb-shadow-${k}`, v.replace(/\s+/g, " ")]));
  const prefixed = (vars: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--${k}`, v]));
  const themeVars = {
    "font-sans": fonts.sans,
    "font-mono": fonts.mono,
    ...Object.fromEntries(Object.entries(radius).map(([k, v]) => [`radius-${k}`, k === "full" ? "9999px" : rem(v.px)])),
    ...Object.fromEntries(Object.entries(motion.easing).map(([k, v]) => [`ease-${k}`, v])),
    ...Object.fromEntries(
      Object.entries(typeScale).flatMap(([name, s]) => [
        [`text-${name}`, rem(s.size)],
        [`text-${name}--line-height`, rem(s.line)],
        [`text-${name}--letter-spacing`, `${s.tracking}em`],
        [`text-${name}--font-weight`, String(s.weight)],
      ]),
    ),
    ...Object.fromEntries(colorNames.map((n) => [`color-${n}`, `var(--sb-${n})`])),
    ...Object.fromEntries(Object.keys(shadow.dark).map((k) => [`shadow-${k}`, `var(--sb-shadow-${k})`])),
    ...Object.fromEntries(Object.keys(motion.spring).map((k) => [`ease-spring-${k}`, `var(--sb-spring-${k})`])),
  };
  const rootVars = {
    "--sb-move": "1",
    ...Object.fromEntries(Object.entries(motion.duration).map(([k, v]) => [`--sb-duration-${k}`, `${v}ms`])),
    ...Object.fromEntries(Object.entries(springProperties()).map(([k, v]) => [k, v.replace(/\s+/g, " ")])),
    ...offsetProperties(),
    ...Object.fromEntries(
      Object.entries(motion.scale).map(([k, v]) => [
        `--sb-scale-${k}`,
        `calc(1 - ${Number((1 - v).toFixed(2))} * var(--sb-move))`,
      ]),
    ),
    ...Object.fromEntries(Object.entries(zIndex).map(([k, v]) => [`--sb-z-${k}`, String(v)])),
    "--sb-control-h": `${density.comfortable.control}px`,
    "--sb-control-h-sm": `${density.comfortable.controlSm}px`,
    "--sb-row-h": `${density.comfortable.row}px`,
  };
  return {
    name: "theme",
    type: "registry:theme",
    title: "Theme",
    description:
      "ikada's tokens: OKLCH colours for light and dark, type scale, radii, shadows, motion, layers and density.",
    // Shadows go in css, not cssVars: shadcn mirrors every non-colour cssVar into @theme inline
    // as `--x: var(--x)`, a self-reference. Colours are mirrored as --color-sb-*, which is harmless.
    cssVars: { theme: themeVars, light: colors(light), dark: colors(dark) },
    css: {
      // Registered properties and keyframes for the focus wake, the checkbox bob, the sprout and the skeleton breath.
      ...Object.fromEntries(Object.entries(motionAtProperties).map(([name, d]) => [`@property ${name}`, d])),
      ...Object.fromEntries(Object.entries(motionKeyframes).map(([name, k]) => [`@keyframes ${name}`, k.frames])),
      "@layer base": {
        ":root": { ...rootVars, ...prefixed(shadows("light")), "color-scheme": "light" },
        ".dark": { ...prefixed(shadows("dark")), "color-scheme": "dark" },
        '[data-density="compact"]': {
          "--sb-control-h": `${density.compact.control}px`,
          "--sb-control-h-sm": `${density.compact.controlSm}px`,
          "--sb-row-h": `${density.compact.row}px`,
        },
        "@media (prefers-reduced-motion: reduce)": { ":root": reducedMotionProperties() },
        ':root[data-motion="reduce"]': reducedMotionProperties(),
        ".sb-chart": {
          "--ts-chart-1": "var(--sb-chart-requests)",
          "--ts-chart-2": "var(--sb-chart-series)",
          "--ts-chart-3": "var(--sb-chart-4xx)",
          "--ts-chart-4": "var(--sb-chart-errors)",
          "--ts-chart-5": "var(--sb-chart-3xx)",
          "--ts-chart-6": "var(--sb-chart-other)",
          "--ts-chart-tooltip-background": "var(--sb-raised)",
          "--ts-chart-tooltip-color": "var(--sb-fg)",
          "--ts-chart-tooltip-border": "0",
          "--ts-chart-tooltip-border-radius": "10px",
          "--ts-chart-tooltip-shadow": "var(--sb-shadow-float)",
          "--ts-chart-tooltip-padding": "8px 10px",
          "--ts-chart-tooltip-font": "500 12px/1.4 var(--font-sans)",
          "font-variant-numeric": "tabular-nums",
        },
        ".sb-chart .ts-chart-tooltip": { "z-index": "var(--sb-z-tooltip)" },
      },
    },
  };
}

export interface BuiltRegistry {
  registry: { $schema: string; name: string; homepage: string; items: RegistryItem[] };
  files: Map<string, string>;
}

/** Builds the registry in memory: the registry.json object and every output file's content. */
export function buildRegistry(url: string): BuiltRegistry {
  const versions = new Map(Object.entries(pkg.dependencies));
  const sources = sourceFiles();
  const bySrc = new Map(sources.map((f) => [f.srcPath, f]));
  const files = new Map<string, string>();
  const ref = (item: string): string => `${url}/${item}.json`;
  const items: RegistryItem[] = [themeItem()];

  for (const file of sources) {
    const raw = readFileSync(join(src, file.srcPath), "utf8");
    const { content, local, packages } = rewriteImports(file, raw, bySrc);
    const dependencies = packages.map((p) => {
      const version = versions.get(p);
      if (!version) throw new Error(`${file.srcPath} imports "${p}", which is not in package.json dependencies`);
      return `${p}@${version}`;
    });
    // Client components for frameworks with server components; shadcn strips it elsewhere.
    const body = file.type === "registry:ui" && file.srcPath.endsWith(".tsx") ? `"use client";\n\n${content}` : content;
    files.set(file.outPath, body);
    const item: RegistryItem = {
      name: file.item,
      type: file.type,
      title: kebabToTitle(file.item),
      description: describe(raw, file.item, `${kebabToTitle(file.item)} from ikada, the Sproutboat design system.`),
      registryDependencies: [...(file.type === "registry:ui" ? ["theme"] : []), ...local].map(ref),
      files: [{ path: file.outPath, type: file.type }],
    };
    if (dependencies.length) item.dependencies = dependencies;
    items.push(item);
  }

  for (const block of blockSources()) items.push(blockItem(block, bySrc, versions, ref, files));

  items.push({
    name: "all",
    type: "registry:item",
    title: "All components",
    description: "Every ikada component, its helpers and the theme.",
    registryDependencies: sources.flatMap((f) => (f.type === "registry:ui" ? [ref(f.item)] : [])),
  });

  return {
    registry: {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "ikada",
      homepage: "https://sproutboat.com/ikada",
      items,
    },
    files,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      url: { type: "string", default: "https://sproutboat.com/ikada/r" },
    },
  });
  if (!values.out) {
    console.error("usage: bun scripts/build-registry.ts --out <dir> [--url <base url of /r>]");
    process.exit(2);
  }
  const out = values.out;
  const url = (values.url ?? "").replace(/\/$/, "");
  const { registry, files } = buildRegistry(url);
  rmSync(join(out, "registry", STYLE), { recursive: true, force: true });
  for (const [path, content] of files) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), content);
  }
  writeFileSync(join(out, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`wrote ${registry.items.length} items to ${join(out, "registry.json")}, linking ${url}`);
}
