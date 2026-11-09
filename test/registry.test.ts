import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../scripts/build-registry";
import { colorNames } from "../tokens/tokens";

const URL = "https://example.test/ikada/r";
const { registry, files } = buildRegistry(URL);
const names = new Set(registry.items.map((i) => i.name));

describe("shadcn registry", () => {
  test("every component and chart file is an item", () => {
    const src = join(import.meta.dir, "../src");
    for (const dir of ["components", "charts"]) {
      for (const f of readdirSync(join(src, dir)).filter((n) => /\.tsx?$/.test(n) && !n.startsWith("index"))) {
        const stem = f.replace(/\.tsx?$/, "");
        expect(names.has(dir === "charts" && stem === "theme" ? "chart-theme" : stem)).toBe(true);
      }
    }
  });

  test("item names are unique and every registry dependency resolves", () => {
    expect(names.size).toBe(registry.items.length);
    for (const item of registry.items) {
      for (const dep of item.registryDependencies ?? []) {
        expect(dep.startsWith(`${URL}/`)).toBe(true);
        expect(names.has(dep.slice(URL.length + 1).replace(/\.json$/, ""))).toBe(true);
      }
    }
  });

  test("no file keeps a relative import; every file is listed by an item", () => {
    const listed = new Set(registry.items.flatMap((i) => (i.files ?? []).map((f) => f.path)));
    for (const [path, content] of files) {
      expect(listed.has(path)).toBe(true);
      expect(content).not.toMatch(/from\s+["']\.\.?\//);
    }
  });

  test("npm dependencies carry the package.json version and skip react", () => {
    const button = registry.items.find((i) => i.name === "button");
    expect(button?.dependencies).toContain("@base-ui/react@^1.9.0");
    for (const item of registry.items) {
      for (const dep of item.dependencies ?? []) expect(dep).not.toMatch(/^react(-dom)?@/);
    }
  });

  test("the theme carries every colour token for light and dark", () => {
    const theme = registry.items.find((i) => i.name === "theme");
    for (const n of colorNames) {
      expect(theme?.cssVars?.light?.[`sb-${n}`]).toMatch(/^oklch\(/);
      expect(theme?.cssVars?.dark?.[`sb-${n}`]).toMatch(/^oklch\(/);
      expect(theme?.cssVars?.theme?.[`color-${n}`]).toBe(`var(--sb-${n})`);
    }
  });

  test("every item is described from its source, never the generic fallback", () => {
    const generic = registry.items.filter((i) => i.description.endsWith("from ikada, the Sproutboat design system."));
    expect(generic.map((i) => i.name)).toEqual([]);
  });

  test("the theme ships the Afloat springs, keyframes and the reduced-motion substitutes", () => {
    const theme = registry.items.find((i) => i.name === "theme");
    const css = theme?.css ?? {};
    const base = css["@layer base"] as Record<string, Record<string, string>>;
    expect(base[":root"]?.["--sb-spring-bob"]).toMatch(/^linear\(0, /);
    expect(base[":root"]?.["--sb-offset-press"]).toBe("calc(1px * var(--sb-move))");
    const reduced = (
      base["@media (prefers-reduced-motion: reduce)"] as unknown as Record<string, Record<string, string>>
    )[":root"];
    expect(reduced?.["--sb-spring-bob"]).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
    expect(base[':root[data-motion="reduce"]']?.["--sb-move"]).toBe("0");
    for (const name of ["sb-wake", "sb-bob", "sb-sprout", "sb-sprout-ring", "sb-breathe"])
      expect(css[`@keyframes ${name}`]).toBeTruthy();
    expect(css["@property --sb-wake"]).toBeTruthy();
    expect(theme?.cssVars?.theme?.["ease-spring-bob"]).toBe("var(--sb-spring-bob)");
  });

  test("every block folder is a registry:block whose files keep no relative import", () => {
    const dir = join(import.meta.dir, "../blocks");
    const blocks = registry.items.filter((i) => i.type === "registry:block");
    expect(blocks.map((b) => b.name).sort()).toEqual(
      readdirSync(dir)
        .filter((n) => !n.startsWith("."))
        .sort(),
    );
    for (const block of blocks) {
      expect(block.files?.[0]?.path).toBe(`registry/ikada/blocks/${block.name}/${block.name}.tsx`);
      expect(block.registryDependencies?.[0]).toBe(`${URL}/theme.json`);
      expect(block.description.length).toBeGreaterThan(20);
      for (const f of block.files ?? []) {
        expect(f.type).toBe("registry:component");
        expect(files.get(f.path)).not.toMatch(/from\s+["']\.\.?\//);
      }
    }
  });

  test("every item has categories and a description a list can show", () => {
    for (const item of registry.items) {
      expect(item.categories?.length, item.name).toBeGreaterThan(0);
      expect(item.description.length, item.name).toBeGreaterThanOrEqual(40);
    }
  });

  test("items that need setup carry docs", () => {
    for (const name of ["theme", "toast", "tooltip", "timeseries-chart"]) {
      expect(registry.items.find((i) => i.name === name)?.docs, name).toBeTruthy();
    }
  });

  test("everything installs under components/ikada with a target placeholder, imports included", () => {
    for (const item of registry.items) {
      for (const f of item.files ?? []) expect(f.target, f.path).toMatch(/^@components\/ikada\//);
    }
    for (const [path, content] of files) {
      expect(content, path).not.toMatch(/@\/(components\/ui|lib\/ikada)\//);
      for (const m of content.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
        expect(m[1], path).toMatch(/^@\/components\/ikada\//);
      }
    }
  });
});
