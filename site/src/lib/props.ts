import { readdirSync } from "node:fs";
import { join } from "node:path";
import { withCustomConfig } from "react-docgen-typescript";

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

/**
 * Descriptions for props whose meaning is the same everywhere, used when the source has no
 * JSDoc for them. A JSDoc comment on the member always wins.
 */
export const standardDocs: Record<string, string> = {
  className: "Classes merged onto the root element, after ikada's own.",
  children: "Content rendered inside the component.",
  ref: "Ref to the underlying DOM element.",
  id: "Id of the underlying element, for labels and aria references.",
  side: "Which side of the trigger the popup opens on. Flips when there is no room.",
  align: "How the popup lines up with the trigger along that side.",
  open: "Whether it is open (controlled).",
  defaultOpen: "Whether it starts open (uncontrolled).",
  onOpenChange: "Called with the new open state when it opens or closes.",
};

// The build runs from site/ (as registry.ts assumes), and bundling moves this file, so no import.meta paths.
const root = join(process.cwd(), "..");

/**
 * The type checker's view of every exported component in src/ and blocks/: resolved types (a union
 * of variant names, not `ButtonVariants`), defaults, and props inherited from ikada's own types.
 * Props that come only from node_modules (a Base UI part, the DOM) stay behind the "Also takes
 * every prop of" line. Parsed once per build, with TypeScript 5 (the site's own copy; the repo
 * itself type-checks with 7, which has no JS compiler API).
 */
let docgen: Map<string, Prop[]> | undefined;
function resolved(): Map<string, Prop[]> {
  if (docgen) return docgen;
  const files = ["src/components", "src/charts"]
    .flatMap((d) => readdirSync(join(root, d)).map((f) => join(root, d, f)))
    .filter((f) => f.endsWith(".tsx"));
  for (const b of readdirSync(join(root, "blocks"))) files.push(join(root, "blocks", b, `${b}.tsx`));
  const parser = withCustomConfig(join(root, "tsconfig.json"), {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    propFilter: (prop) => !prop.parent || !/node_modules/.test(prop.parent.fileName),
  });
  docgen = new Map();
  for (const c of parser.parse(files)) {
    if (!/^[A-Z]/.test(c.displayName)) continue;
    docgen.set(
      c.displayName,
      Object.values(c.props)
        .filter((p) => !/^(style|render|key|ref)$/.test(p.name) || p.description)
        .map((p) => ({
          name: p.name,
          optional: !p.required,
          type: (p.type.name === "enum" && p.type.raw ? p.type.raw : p.type.name).replace(/\s+/g, " "),
          doc: [
            p.description.replace(/\s+/g, " ").trim() || standardDocs[p.name] || "",
            p.defaultValue && !/\bdefault/i.test(p.description) ? `Default \`${p.defaultValue.value}\`.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        })),
    );
  }
  return docgen;
}

export function propsTables(source: string): PropsTable[] {
  const tables = propsTablesFromSource(source);
  const types = resolved();
  // Components the interface scan missed (props declared as an intersection type) get a table too.
  for (const m of source.matchAll(/export function ([A-Z]\w*)\b/g)) {
    const name = m[1] ?? "";
    const props = types.get(name);
    if (!props?.length) continue;
    // `AccessibleName` is a union (aria-label or the deprecated ariaLabel), which the checker cannot list as one prop.
    if (/AccessibleName/.test(source) && !props.some((p) => p.name === "aria-label"))
      props.unshift(
        {
          name: "aria-label",
          optional: false,
          type: "string",
          doc: "Accessible name of the chart. Required (or the deprecated `ariaLabel`).",
        },
        { name: "ariaLabel", optional: true, type: "string", doc: "Deprecated: use `aria-label`. Removed in 0.3.0." },
      );
    const hit = tables.find((t) => t.name === `${name}Props`);
    if (hit) hit.props = props;
    else tables.push({ name: `${name}Props`, extends: "", props });
  }
  return tables;
}

function propsTablesFromSource(source: string): PropsTable[] {
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
    if (m) {
      const name = (m[2] ?? "").replace(/"/g, "");
      out.push({
        name,
        optional: Boolean(m[3]),
        type: (m[4] ?? "").replace(/\s+/g, " ").trim(),
        doc: doc || standardDocs[name] || "",
      });
    }
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
    if (depth === 0 && (c === ";" || c === "\n") && current.trim() && !/[|&,:]\s*$/.test(current.trim())) {
      flush();
      continue;
    }
    current += c;
  }
  if (current.trim()) flush();
  return out;
}
