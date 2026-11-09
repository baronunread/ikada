#!/usr/bin/env node
/**
 * Renames the 0.1 prop spellings that 0.2 deprecates (they still work until 0.3.0):
 *
 *   <StatusDot status=...>, <StatusGlyph status=...>   ->  tone=
 *   <Skeleton kind=...>                                ->  variant=
 *   <Sparkline ariaLabel=...>, <TimeseriesChart ...>   ->  aria-label=
 *
 *   node node_modules/@sproutboat/ikada/codemods/0.2-rename-props.mjs src            (dry run, prints the files)
 *   node node_modules/@sproutboat/ikada/codemods/0.2-rename-props.mjs src --write
 *
 * It rewrites attribute names on those JSX tags only (a tag is scanned to its closing `>` with
 * braces and strings balanced), never values. Option objects such as
 * `{ value, label, ariaLabel }` for SegmentedControl are data, not JSX: rename those by hand.
 * Review the diff.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RULES = {
  StatusDot: { status: "tone" },
  StatusGlyph: { status: "tone" },
  Skeleton: { kind: "variant" },
  Sparkline: { ariaLabel: "aria-label" },
  TimeseriesChart: { ariaLabel: "aria-label" },
};

/** The index just after the `>` that closes the tag opened at `start` (`<Name`). */
function tagEnd(code, start) {
  let depth = 0;
  let quote = "";
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || (c === "`" && depth > 0)) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i + 1;
  }
  return -1;
}

/** Renames top-level attributes inside one tag's text. */
function renameAttributes(tag, renames) {
  let out = "";
  let depth = 0;
  let quote = "";
  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (quote) {
      out += c;
      if (c === "\\") out += tag[++i] ?? "";
      else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    if (depth === 0 && /\s/.test(tag[i - 1] ?? "") && /[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z][\w-]*/.exec(tag.slice(i));
      const name = m ? m[0] : "";
      if (name && renames[name] && /^\s*=/.test(tag.slice(i + name.length))) {
        out += renames[name];
        i += name.length - 1;
        continue;
      }
    }
    out += c;
  }
  return out;
}

export function transform(code) {
  let out = "";
  let at = 0;
  const re = new RegExp(`<(${Object.keys(RULES).join("|")})(?=[\\s/>])`, "g");
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const end = tagEnd(code, m.index);
    if (end < 0) continue;
    out += code.slice(at, m.index) + renameAttributes(code.slice(m.index, end), RULES[m[1]]);
    at = end;
    re.lastIndex = end;
  }
  return out + code.slice(at);
}

function* walk(path) {
  if (statSync(path).isDirectory()) {
    for (const f of readdirSync(path)) if (f !== "node_modules" && f !== "dist") yield* walk(join(path, f));
  } else if (/\.(tsx|jsx|astro|mdx)$/.test(path)) yield path;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const roots = args.filter((a) => !a.startsWith("--"));
  if (!roots.length) {
    console.error("usage: 0.2-rename-props.mjs <dir or file>... [--write]");
    process.exit(2);
  }
  let changed = 0;
  for (const root of roots) {
    for (const file of walk(root)) {
      const before = readFileSync(file, "utf8");
      const after = transform(before);
      if (after === before) continue;
      changed++;
      console.log(`${write ? "rewrote" : "would rewrite"} ${file}`);
      if (write) writeFileSync(file, after);
    }
  }
  console.log(`${changed} file${changed === 1 ? "" : "s"} ${write ? "changed" : "would change"}`);
}
