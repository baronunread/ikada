import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";

/**
 * The live preview of one block: blocks/<slug>/<slug>.tsx, rendered with no props so it shows
 * its sample data. Each block is its own chunk, loaded on its page only.
 */
const modules = import.meta.glob<Record<string, unknown>>("../../../blocks/*/*.tsx");

const pascal = (slug: string): string =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

const cache = new Map<string, ComponentType>();

function load(slug: string): ComponentType {
  const hit = cache.get(slug);
  if (hit) return hit;
  const loader = modules[`../../../blocks/${slug}/${slug}.tsx`];
  const made: ComponentType = loader
    ? lazy(() =>
        loader().then((mod) => {
          const Block = mod[pascal(slug)] as ComponentType | undefined;
          if (!Block) throw new Error(`blocks/${slug}/${slug}.tsx does not export ${pascal(slug)}`);
          return { default: Block };
        }),
      )
    : () => <p className="text-fg-muted">This block has no preview.</p>;
  cache.set(slug, made);
  return made;
}

export default function BlockPreview({ slug }: { slug: string }) {
  const Block = load(slug);
  return (
    <ToastProvider>
      <TooltipProvider>
        <Suspense fallback={<div className="min-h-48 animate-pulse rounded-xl bg-surface" />}>
          <div data-block-ready={slug}>
            <Block />
          </div>
        </Suspense>
      </TooltipProvider>
    </ToastProvider>
  );
}
