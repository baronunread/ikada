/** The playground's pure parts, shared by the island and the page (which writes Usage from them). */
import type { Playground, PlaygroundValues } from "../examples/types";

export function initialValues(spec: Playground): PlaygroundValues {
  const v: PlaygroundValues = {};
  for (const c of spec.controls) {
    v[c.prop] =
      c.default ??
      (c.kind === "boolean" ? false : c.kind === "number" ? c.min : c.kind === "select" ? (c.options[0] ?? "") : "");
  }
  return { ...v, ...spec.initial };
}

/** The code for the current values: the spec's own writer, else one element with the changed props. */
export function writeCode(spec: Playground, v: PlaygroundValues): string {
  if (spec.code) return spec.code(v);
  const attrs: string[] = [];
  for (const [k, val] of Object.entries(spec.fixed ?? {}))
    attrs.push(/^\{.*\}$/.test(val) ? `${k}=${val}` : `${k}="${val}"`);
  for (const c of spec.controls) {
    if (c.prop === "children") continue;
    const val = v[c.prop];
    if (val === c.default || val === undefined || val === "") continue;
    if (c.kind === "boolean") attrs.push(val ? c.prop : `${c.prop}={false}`);
    else if (c.kind === "number") attrs.push(`${c.prop}={${val}}`);
    else attrs.push(`${c.prop}="${String(val)}"`);
  }
  const open = `<${spec.component}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  const children = v.children === undefined ? "" : String(v.children);
  return children ? `${open}>\n  ${children}\n</${spec.component}>` : `${open} />`;
}
