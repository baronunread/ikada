import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";
import { IkadaMark } from "./IkadaMark";

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

/** The block's chunk is loading: the mark's loading loop, shown only if it takes over 400ms. */
function Loading() {
  return (
    <div className="grid min-h-48 place-items-center rounded-xl bg-surface text-fg-muted" aria-busy="true">
      <IkadaMark size={48} motion="none" loading className="ikm-spinner" title="Loading the preview" />
    </div>
  );
}

export default function BlockPreview({ slug }: { slug: string }) {
  const Block = load(slug);
  return (
    <ToastProvider>
      <TooltipProvider>
        <Suspense fallback={<Loading />}>
          <div data-block-ready={slug}>
            <Block />
          </div>
        </Suspense>
      </TooltipProvider>
    </ToastProvider>
  );
}
