import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { ToastProvider } from "../../../src/components/toast";
import { TooltipProvider } from "../../../src/components/tooltip";
import { demo } from "../lib/demo-href";
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

/**
 * Props that point a block's sample links at real pages of this site. The registry source keeps
 * its neutral defaults (in-app fragments); only the preview here is retargeted.
 */
const siteProps: Record<string, Record<string, unknown>> = {
  "project-tray": { projectHref: () => demo.projects, sproutHref: () => demo.projects },
  "usage-line": { href: demo.usage },
};

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
          const props = siteProps[slug];
          return { default: props ? () => <Block {...props} /> : Block };
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
