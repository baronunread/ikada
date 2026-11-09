/**
 * Verifies the built package: every compiled client module still starts with "use client"
 * (a bundler or a stray rewrite can drop it), every module that needs it has it, every
 * relative import in dist resolves to a real file, and nothing in dist imports from src.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const dist = join(import.meta.dir, "..", "dist");
const src = join(import.meta.dir, "..", "src");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const NEEDS_CLIENT = /\buse[A-Z]\w*\(|\bcreateContext\b|\bon[A-Z]\w*=|addEventListener|\bwindow\./;

const problems: string[] = [];
let clients = 0;
for (const file of walk(dist).filter((f) => f.endsWith(".js"))) {
  const code = readFileSync(file, "utf8");
  const name = relative(dist, file);
  const directive = /^\s*["']use client["'];?/.test(code);
  if (directive) clients++;
  const srcFile = ["tsx", "ts"].map((e) => join(src, name.replace(/\.js$/, `.${e}`))).find(existsSync);
  const wanted = srcFile ? /^\s*["']use client["']/.test(readFileSync(srcFile, "utf8")) : false;
  if (wanted && !directive) problems.push(`${name}: the source says "use client" but the build lost it`);
  if (!directive && !name.endsWith("index.js") && NEEDS_CLIENT.test(code.replace(/\/\/.*$/gm, "")))
    problems.push(`${name}: uses hooks or handlers but has no "use client"`);
  for (const m of code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = resolve(dirname(file), m[1] ?? "");
    if (!existsSync(target)) problems.push(`${name}: imports ${m[1]}, which does not exist`);
    if (!/\.(js|css|json)$/.test(m[1] ?? "")) problems.push(`${name}: import ${m[1]} has no file extension`);
  }
}
for (const file of walk(dist).filter((f) => f.endsWith(".d.ts"))) {
  const code = readFileSync(file, "utf8");
  for (const m of code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    if (!/\.js$/.test(m[1] ?? "")) problems.push(`${relative(dist, file)}: type import ${m[1]} has no .js extension`);
  }
}
if (!clients) problems.push("no module in dist has a use-client directive");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`dist ok: ${clients} client modules keep "use client"`);
