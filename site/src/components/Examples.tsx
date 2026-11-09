import { lazy, Suspense, useEffect, useId, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Input } from "../../../src/components/input";
import { SegmentedControl } from "../../../src/components/segmented-control";
import { Select } from "../../../src/components/select";
import { Switch } from "../../../src/components/switch";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";
import { Code } from "../lib/highlight";
import { initialValues, writeCode } from "../lib/playground";
import type { Control, Example, Playground as PlaygroundSpec, PlaygroundValues, Preview } from "../examples/types";
import { Icon } from "./icons";

/**
 * A component page's live parts, from examples/<slug>.tsx (each slug its own chunk, loaded on its
 * page only, rendered on the server too so it is in the HTML before hydration):
 * - part "top": the stage under the title. The prop playground when the file exports one (Deck),
 *   else the first example.
 * - part "examples": every example in its own stage with Preview / Code, a theme switch and copy.
 */
interface Module {
  examples?: Example[];
  preview?: Preview;
  playground?: PlaygroundSpec;
}
const modules = import.meta.glob<Module>("../examples/*.tsx");

const cache = new Map<string, ComponentType>();

function load(slug: string, part: Part): ComponentType {
  const key = `${slug}:${part}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const loader = modules[`../examples/${slug}.tsx`];
  const made: ComponentType = loader
    ? lazy(() => loader().then((mod) => ({ default: () => (part === "top" ? <Top mod={mod} /> : <List mod={mod} />) })))
    : () => <p>No live examples for this component yet.</p>;
  cache.set(key, made);
  return made;
}

type Part = "top" | "examples";

export default function Examples({ slug, part }: { slug: string; part: Part }) {
  const Loaded = load(slug, part);
  return (
    <ToastProvider>
      <TooltipProvider>
        <Suspense fallback={<div className="stage" style={{ minHeight: part === "top" ? 320 : 480 }} />}>
          <Loaded />
        </Suspense>
      </TooltipProvider>
    </ToastProvider>
  );
}

function Top({ mod }: { mod: Module }) {
  if (mod.playground) return <PlaygroundStage spec={mod.playground} />;
  const first = mod.examples?.[0];
  if (first)
    return (
      <Stage title={first.title} code={first.code} top>
        {first.render()}
      </Stage>
    );
  if (mod.preview)
    return (
      <Stage title="Preview" code="" top>
        {mod.preview()}
      </Stage>
    );
  return null;
}

function List({ mod }: { mod: Module }) {
  return (
    <>
      {(mod.examples ?? []).map((ex) => (
        <Stage key={ex.title} title={ex.title} description={ex.description} code={ex.code} id={slugify(ex.title)}>
          {ex.render()}
        </Stage>
      ))}
    </>
  );
}

export const slugify = (s: string): string =>
  `ex-${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/** The theme the preview shows: the page's, unless this stage was switched. */
function useScopedTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const toggle = () => {
    const page = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const now = theme ?? page;
    const next = now === "light" ? "dark" : "light";
    setTheme(next === page ? null : next);
  };
  return { theme, toggle };
}

function ThemeButton({ theme, toggle }: { theme: "light" | "dark" | null; toggle: () => void }) {
  return (
    <button
      className="ibtn"
      type="button"
      onClick={toggle}
      aria-pressed={theme !== null}
      aria-label="Preview in the other theme"
      title="Preview in the other theme"
    >
      <Icon name={theme === "light" ? "sun" : theme === "dark" ? "moon" : "sun"} />
    </button>
  );
}

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      const live = document.querySelector("[data-announce]");
      if (live) live.textContent = "Copied to the clipboard";
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard refused: the code stays selectable */
    }
  };
  return (
    <button className="copy" type="button" onClick={copy} data-done={done ? "" : undefined} aria-label={label}>
      <Icon name={done ? "check" : "copy"} />
      <span className="lbl" aria-hidden="true">
        {done ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

const VIEWS = [
  { value: "preview", label: "Preview" },
  { value: "code", label: "Code" },
] as const;

function Stage({
  title,
  description,
  code,
  children,
  top,
  id,
  aside,
}: {
  title: string;
  description?: string;
  code: string;
  children: ReactNode;
  top?: boolean;
  id?: string;
  aside?: ReactNode;
}) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const { theme, toggle } = useScopedTheme();
  const titleId = useId();
  const Heading = top ? "h2" : "h3";
  return (
    <div className="stage" role="group" aria-labelledby={titleId} id={id}>
      <div className="stage-bar">
        <div className="ttl">
          <Heading
            id={titleId}
            style={{ fontSize: 14, margin: 0, fontWeight: 600 }}
            className={top ? "sr-only" : undefined}
          >
            {title}
          </Heading>
          {description ? <small>{description}</small> : null}
        </div>
        <div className="right">
          {code ? (
            <SegmentedControl
              size="sm"
              className="w-auto"
              aria-label={`${title}: view`}
              options={VIEWS}
              value={view}
              onValueChange={setView}
            />
          ) : null}
          <ThemeButton theme={theme} toggle={toggle} />
          {code ? <CopyButton text={code} label={`Copy the ${title} code`} /> : null}
        </div>
      </div>
      <div className={aside ? "pg" : undefined}>
        <div>
          <div
            className={`${top ? "stage-preview top" : "stage-preview"}${theme === "dark" ? " dark" : ""}`}
            data-theme={theme ?? undefined}
            data-demo
            hidden={view !== "preview"}
          >
            {children}
          </div>
          {code ? (
            <div className="stage-code" hidden={view !== "code"}>
              <Code code={code} label={`${title} code`} />
            </div>
          ) : null}
        </div>
        {aside}
      </div>
    </div>
  );
}

function PlaygroundStage({ spec }: { spec: PlaygroundSpec }) {
  const [values, setValues] = useState<PlaygroundValues>(() => initialValues(spec));
  const set = (prop: string, value: PlaygroundValues[string]) => setValues((v) => ({ ...v, [prop]: value }));
  const code = writeCode(spec, values);
  const panel = (
    <div className="pg-panel">
      <h3>Props</h3>
      {spec.controls.map((c) => (
        <ControlRow key={c.prop} control={c} value={values[c.prop]} onChange={(val) => set(c.prop, val)} />
      ))}
    </div>
  );
  return (
    <Stage title={`${spec.component} playground`} code={code} top aside={panel}>
      {spec.render(values)}
    </Stage>
  );
}

function ControlRow({
  control: c,
  value,
  onChange,
}: {
  control: Control;
  value: PlaygroundValues[string] | undefined;
  onChange: (v: PlaygroundValues[string]) => void;
}) {
  const id = useId();
  if (c.kind === "boolean") {
    return (
      <div className="pg-row">
        <label className="pg-k" htmlFor={id}>
          {c.prop}
        </label>
        <Switch id={id} checked={Boolean(value)} onCheckedChange={(on) => onChange(on)} />
      </div>
    );
  }
  if (c.kind === "select") {
    // Up to ~3 short values sit beside the label; longer sets get the row to themselves; many become a Select.
    const chars = c.options.join("").length;
    const inline = c.options.length <= 3 && chars <= 12;
    const seg = c.options.length <= 5 && chars <= 34;
    return (
      <div className={inline ? "pg-row" : "pg-row stack"}>
        <span className="pg-k" id={id}>
          {c.prop}
        </span>
        {seg ? (
          <SegmentedControl
            size="sm"
            className={inline ? "w-auto" : undefined}
            aria-label={c.prop}
            options={c.options.map((o) => ({ value: o, label: o }))}
            value={String(value)}
            onValueChange={(v) => onChange(v)}
          />
        ) : (
          <Select
            aria-label={c.prop}
            options={c.options.map((o) => ({ value: o, label: o }))}
            value={String(value)}
            onValueChange={(v) => v != null && onChange(v)}
          />
        )}
      </div>
    );
  }
  return (
    <div className="pg-row stack">
      <label className="pg-k" htmlFor={id}>
        {c.prop}
      </label>
      <Input
        id={id}
        type={c.kind === "number" ? "number" : "text"}
        {...(c.kind === "number" ? { min: c.min, max: c.max, step: c.step ?? 1 } : {})}
        value={String(value ?? "")}
        onChange={(e) => onChange(c.kind === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)}
      />
    </div>
  );
}
