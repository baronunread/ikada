import { lazy, Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import { TooltipProvider } from "../../../src/components/tooltip";
import type { Preview } from "../examples/types";
import { Icon } from "./icons";

/**
 * The live components under the hero: each component's own preview (examples/<slug>.tsx), hydrated
 * so it works, on a still surface. The caption under each is the link to its page (Waterline's
 * bento after review: the tile does not lift, the caption is named and 36px tall).
 */
const previews = import.meta.glob<Preview>("../examples/*.tsx", { import: "preview" });
const cache = new Map<string, ComponentType>();
function load(slug: string): ComponentType | null {
  const loader = previews[`../examples/${slug}.tsx`];
  if (!loader) return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  const made = lazy(() => loader().then((render) => ({ default: () => <>{render()}</> })));
  cache.set(slug, made);
  return made;
}

export interface Tile {
  slug: string;
  title: string;
  href: string;
  span: 4 | 5 | 6 | 7 | 8 | 12;
}

function Cell({ tile, children }: { tile: Tile; children: ReactNode }) {
  return (
    <li className="tile" data-span={tile.span}>
      <div className="t-body" data-demo>
        {children}
      </div>
      <a className="t-cap" href={tile.href}>
        <b>{tile.title}</b>
        <span className="t-go">
          Docs <Icon name="arrow" />
        </span>
      </a>
    </li>
  );
}

export default function HomeShowcase({ tiles }: { tiles: Tile[] }) {
  return (
    <TooltipProvider>
      <ul className="bento" aria-label="Live components">
        {tiles.map((t) => {
          const Live = load(t.slug);
          return Live ? (
            <Cell key={t.slug} tile={t}>
              <Suspense fallback={null}>
                <Live />
              </Suspense>
            </Cell>
          ) : null;
        })}
      </ul>
    </TooltipProvider>
  );
}
