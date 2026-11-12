import type { ComponentType } from "react";
import { TooltipProvider } from "../../../src/components/tooltip";
import type { Preview } from "../examples/types";

/**
 * Static thumbnails for the overview grids. Rendered on the server only (no client directive), so
 * they ship as plain HTML: each component's own `thumb` (or `preview`) from examples/<slug>.tsx,
 * each block's own sample render. The wrapper in the Astro page makes them inert.
 */
const examples = import.meta.glob<{ preview?: Preview; thumb?: Preview }>("../examples/*.tsx", { eager: true });
const blockMods = import.meta.glob<Record<string, unknown>>("../../../blocks/*/*.tsx", { eager: true });

const pascal = (slug: string): string =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

export function ComponentThumb({ slug }: { slug: string }) {
  const mod = examples[`../examples/${slug}.tsx`];
  const render = mod?.thumb ?? mod?.preview;
  if (!render) return null;
  return <TooltipProvider>{render()}</TooltipProvider>;
}

export function BlockThumb({ slug }: { slug: string }) {
  const Block = blockMods[`../../../blocks/${slug}/${slug}.tsx`]?.[pascal(slug)] as ComponentType | undefined;
  if (!Block) return null;
  return (
    <TooltipProvider>
      <Block />
    </TooltipProvider>
  );
}
