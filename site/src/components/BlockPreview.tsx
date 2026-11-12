import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { toast } from "../../../src/components/toast";
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
  "project-tray": {
    projectHref: () => demo.projects,
    sproutHref: () => demo.projects,
    // the sample has no app behind it: say what the button does in a real one
    onNewSprout: () =>
      toast.add({ title: "New project", description: "In your app this opens the create dialog.", duration: 3200 }),
  },
  "usage-line": { href: demo.usage },
  "empty-states": {
    onCreate: () =>
      toast.add({ title: "New project", description: "In your app this opens the create dialog.", duration: 3200 }),
  },
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
    <div className="grid h-full min-h-12 place-items-center rounded-xl bg-surface text-fg-muted" aria-busy="true">
      <IkadaMark size={48} motion="none" loading className="ikm-spinner" title="Loading the preview" />
    </div>
  );
}

/**
 * `defer`: mount the block only when its box nears the viewport (the blocks index has eleven). Client-only either way,
 * so there is nothing to mismatch on hydration; the box keeps its reserved height meanwhile.
 */
export default function BlockPreview({ slug, defer = false }: { slug: string; defer?: boolean }) {
  const Block = load(slug);
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(!defer);
  useEffect(() => {
    if (on || !box.current) return;
    if (!("IntersectionObserver" in window)) return setOn(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setOn(true), io.disconnect()), {
      rootMargin: "600px 0px",
    });
    io.observe(box.current);
    return () => io.disconnect();
  }, [on]);
  if (!on) return <div ref={box} aria-hidden="true" />;
  return (
    <TooltipProvider>
      <Suspense fallback={<Loading />}>
        <div data-block-ready={slug}>
          <Block />
        </div>
      </Suspense>
    </TooltipProvider>
  );
}
