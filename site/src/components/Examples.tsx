import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";
import type { Example } from "../examples/types";

/**
 * The live examples of one component page. Each page's examples are their own chunk
 * (examples/<slug>.tsx), loaded on that page only.
 */
const modules = import.meta.glob<{ examples: Example[] }>("../examples/*.tsx");

const cache = new Map<string, ComponentType>();

/** One lazy component per slug, kept so a re-render does not suspend again. */
function load(slug: string): ComponentType {
  const hit = cache.get(slug);
  if (hit) return hit;
  const made = make(slug);
  cache.set(slug, made);
  return made;
}

function make(slug: string): ComponentType {
  const loader = modules[`../examples/${slug}.tsx`];
  if (!loader)
    return () => <p className="text-fg-muted">No live examples for this component yet.</p>;
  return lazy(() =>
    loader().then(({ examples }) => ({
      default: () => (
        <div className="flex flex-col gap-4">
          {examples.map((ex) => (
            <section key={ex.title} className="rounded-xl bg-surface shadow-card">
              <header className="border-b border-hairline px-4 py-2.5">
                <h3 className="text-md">{ex.title}</h3>
                {ex.description ? <p className="text-sm text-fg-muted">{ex.description}</p> : null}
              </header>
              <div className="flex min-h-24 flex-wrap items-center gap-3 p-4 sm:p-6">
                {ex.render()}
              </div>
            </section>
          ))}
        </div>
      ),
    })),
  );
}

export default function Examples({ slug }: { slug: string }) {
  const Loaded = load(slug);
  return (
    <ToastProvider>
      <TooltipProvider>
        <Suspense fallback={<div className="min-h-48 animate-pulse rounded-xl bg-surface" />}>
          <Loaded />
        </Suspense>
      </TooltipProvider>
    </ToastProvider>
  );
}
