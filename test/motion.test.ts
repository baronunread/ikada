import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const src = join(import.meta.dir, "../src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(src).filter((f) => /\.tsx?$/.test(f));
const rel = (f: string): string => f.slice(src.length + 1);

/**
 * Animation budget: transition and animate only transform-class properties (translate, scale, rotate,
 * transform), opacity, and paint-only colour and shadow. Width, height and position move the layout
 * every frame. The files below animate size on purpose, because the size IS the thing that changes:
 * a rail that collapses, a toast stack that closes its gap, text that morphs to its new height, a
 * pebble that stretches to the next tab, a meter that fills. Do not add to this list without a reason.
 */
const LAYOUT_BOUND = new Set([
  "components/sidebar.tsx",
  "components/toast.tsx",
  "components/meter.tsx",
  "lib/crossfade.tsx",
  "lib/cn.ts",
]);
const layoutProp =
  /(?:transition-\[[^\]]*\b(?:width|height|top|left|right|bottom|margin|padding|inset)\b[^\]]*\]|\[transition:[^\]]*\b(?:width|height|top|left|right|bottom|margin|padding)_var)/;

describe("motion", () => {
  test("only the layout-bound components animate size or position", () => {
    const offenders = files.filter((f) => layoutProp.test(readFileSync(f, "utf8"))).map(rel);
    expect(offenders.filter((f) => !LAYOUT_BOUND.has(f))).toEqual([]);
  });

  test("no transition names all properties", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/transition-all|\[transition:all/);
  });

  test("charts stay out of the main entry and the other components", () => {
    expect(readFileSync(join(src, "index.ts"), "utf8")).not.toMatch(/charts/);
    for (const f of files.filter((f) => !rel(f).startsWith("charts/"))) {
      expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/@tanstack\/charts|\.\.\/charts|\.\/charts/);
    }
  });
});
