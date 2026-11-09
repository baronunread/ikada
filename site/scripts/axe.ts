/**
 * axe-core on every page of the built docs (and so on every example, which render in the pages),
 * light and dark. Fails on any violation.
 *   bun run build && PORT=4413 bun scripts/preview.ts   (another terminal)
 *   bun scripts/axe.ts [--url http://127.0.0.1:4413/ikada] [--only <path-substring>]
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => (argv.includes(k) ? argv[argv.indexOf(k) + 1]! : d);
const base = opt("--url", "http://127.0.0.1:4413/ikada").replace(/\/$/, "");
const only = opt("--only", "");
const axeSource = readFileSync(join(import.meta.dir, "../../node_modules/axe-core/axe.min.js"), "utf8").toString();
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>[^<]*\/ikada\/?([^<]*)<\/loc>/g)]
  .map((m) => m[1] ?? "")
  .filter((p) => p.includes(only));

const browser = await chromium.launch();
let bad = 0;
for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => {
    localStorage.setItem("ikada-theme", t);
    sessionStorage.setItem("ikada-mark-intro", "1");
  }, theme);
  const page = await ctx.newPage();
  for (const path of paths) {
    await page.goto(`${base}/${path}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      // @ts-expect-error injected
      const r = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      });
      return r.violations.map((v: any) => ({
        id: v.id,
        impact: v.impact,
        n: v.nodes.length,
        sample: v.nodes[0]?.target?.join(" "),
      }));
    });
    for (const v of result) {
      bad++;
      console.log(`${theme} /${path}: ${v.id} (${v.impact}) x${v.n}  e.g. ${v.sample}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `axe: ${bad} violations` : `axe: 0 violations on ${paths.length} pages x 2 themes`);
process.exit(bad ? 1 : 0);
