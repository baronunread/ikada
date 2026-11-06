import type { Preview } from "../examples/types";

/**
 * A component's compact preview for its overview tile. Rendered on the server only (no client
 * directive): the tile is a link, so its preview is a static picture, inert and hidden from
 * assistive tech. Components without a `preview` export get no picture.
 */
const previews = import.meta.glob<Preview>("../examples/*.tsx", { eager: true, import: "preview" });

export const hasPreview = (slug: string): boolean => typeof previews[`../examples/${slug}.tsx`] === "function";

export default function TilePreview({ slug }: { slug: string }) {
  const render = previews[`../examples/${slug}.tsx`];
  return typeof render === "function" ? <>{render()}</> : null;
}
