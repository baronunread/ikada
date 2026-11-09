import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { exportsMap } from "../scripts/build-dist";

const root = join(import.meta.dir, "..");
const read = (p: string): string => readFileSync(join(root, p), "utf8");

describe("package", () => {
  test("exports are generated from src/components, types first", () => {
    expect(pkg.exports).toEqual(exportsMap() as typeof pkg.exports);
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (typeof value === "string") continue;
      expect(Object.keys(value)[0], key).toBe("types");
    }
  });

  test("every component has a subpath, internal helpers do not", () => {
    expect(Object.keys(pkg.exports)).toContain("./button");
    expect(Object.keys(pkg.exports)).toContain("./dialog");
    expect(Object.keys(pkg.exports)).not.toContain("./toast-api");
    expect(Object.keys(pkg.exports)).not.toContain("./status");
  });

  test("Base UI and charts are peers, charts optional, with ranges", () => {
    expect(pkg.peerDependencies["@base-ui/react"]).toMatch(/^\^/);
    expect(pkg.peerDependencies["@tanstack/charts"]).toMatch(/^\^/);
    expect(pkg.peerDependenciesMeta["@tanstack/charts"].optional).toBe(true);
    expect(Object.keys(pkg.dependencies)).not.toContain("@base-ui/react");
    expect(Object.keys(pkg.dependencies)).not.toContain("@tanstack/charts");
    expect(Object.keys(pkg.dependencies)).not.toContain("tailwind-variants");
  });

  test("every source file that calls a hook or creates context is a client module", () => {
    const missing: string[] = [];
    for (const dir of ["src/components", "src/lib", "src/charts"]) {
      for (const f of readdirSync(join(root, dir)).filter((n) => n.endsWith(".tsx"))) {
        const code = read(`${dir}/${f}`);
        const needs = /\buse[A-Z]\w*\(|\bcreateContext\b|\bon[A-Z]\w*=/.test(code.replace(/\/\/.*$/gm, ""));
        if (needs && !/^"use client";/.test(code)) missing.push(`${dir}/${f}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("the version has a changelog entry", () => {
    expect(read("CHANGELOG.md")).toContain(`## ${pkg.version}`);
  });
});
