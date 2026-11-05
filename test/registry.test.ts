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
});
