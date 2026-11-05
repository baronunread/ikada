/**
 * Props tables from the source: the members each exported `…Props` interface declares itself,
 * with their types and JSDoc. Inherited props (a Base UI part's, a DOM element's) are named by
 * the `extends` clause instead of listed one by one.
 */
export interface Prop {
  name: string;
  type: string;
  optional: boolean;
  doc: string;
}

export interface PropsTable {
  name: string;
  extends: string;
  props: Prop[];
}

/** The text between the brace at `open` and its partner. */
function block(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return "";
}

export function propsTables(source: string): PropsTable[] {
  const tables: PropsTable[] = [];
  const re = /export interface (\w+Props)\b([^{]*)\{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const body = block(source, m.index + m[0].length - 1);
    const ext = (m[2] ?? "")
      .replace(/^\s*extends\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    tables.push({ name: m[1] ?? "", extends: ext, props: members(body) });
  }
  return tables;
}

/** Top-level members of an interface body: `/** doc *\/ name?: type;`. */
function members(body: string): Prop[] {
  const out: Prop[] = [];
  let depth = 0;
  let current = "";
  let doc = "";
  const flush = (): void => {
    const text = current.trim();
    current = "";
    const m = /^(readonly\s+)?("[^"]+"|[\w$]+)(\?)?\s*:\s*([\s\S]+)$/.exec(text);
    if (m)
      out.push({
        name: (m[2] ?? "").replace(/"/g, ""),
        optional: Boolean(m[3]),
        type: (m[4] ?? "").replace(/\s+/g, " ").trim(),
        doc,
      });
    doc = "";
  };
  for (let i = 0; i < body.length; i++) {
    if (depth === 0 && body.startsWith("/**", i)) {
      const end = body.indexOf("*/", i);
      doc = body
        .slice(i + 3, end)
        .replace(/^\s*\*\s?/gm, "")
        .replace(/\s+/g, " ")
        .trim();
      i = end + 1;
      continue;
    }
    if (depth === 0 && body.startsWith("//", i)) {
      i = body.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    const c = body[i] ?? "";
    if ("{([<".includes(c)) depth++;
    if ("})]>".includes(c) && !(c === ">" && body[i - 1] === "=")) depth--;
    if (
      depth === 0 &&
      (c === ";" || c === "\n") &&
      current.trim() &&
      !/[|&,:]\s*$/.test(current.trim())
    ) {
      flush();
      continue;
    }
    current += c;
  }
  if (current.trim()) flush();
  return out;
}
