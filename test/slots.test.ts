import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dir, "../src/components");
const css = readFileSync(join(import.meta.dir, "../src/theme.css"), "utf8");

describe("data-slot", () => {
  test("every component file marks its parts with data-slot, like shadcn v4", () => {
    const missing = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => !readFileSync(join(dir, f), "utf8").includes("data-slot"));
    expect(missing).toEqual([]);
  });

  test("the forced-colors block targets slots that exist", () => {
    const block = css.slice(css.indexOf("@media (forced-colors: active)"));
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    for (const slot of new Set([...block.matchAll(/data-slot="([\w-]+)"/g)].map((m) => m[1]))) {
      expect(all, `slot ${slot}`).toContain(`data-slot="${slot}"`);
    }
  });
});
