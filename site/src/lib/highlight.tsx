/**
 * A small JSX/TS highlighter for the chrome's own snippets (the stage, usage, playground code):
 * strings, keywords, tags, attributes and comments, in ikada's code colours. Block files use Shiki.
 */
import type { ReactNode } from "react";

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*|\/?>)|\b(import|from|export|default|const|let|function|return|await|async|type|interface|new|true|false|null|undefined)\b|([A-Za-z_$][\w$-]*)(?==)/g;

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    const [text, comment, str, tag, kw] = m;
    const cls = comment ? "t-c" : str ? "t-s" : tag ? "t-g" : kw ? "t-k" : "t-a";
    out.push(
      <span key={key++} className={cls}>
        {text}
      </span>,
    );
    last = i + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

/** `<pre class="code">` with the highlighted snippet. */
export function Code({ code, id, label }: { code: string; id?: string; label?: string }) {
  return (
    <pre className="code" id={id} tabIndex={0} aria-label={label ?? "Code"}>
      <code>{highlight(code)}</code>
    </pre>
  );
}
