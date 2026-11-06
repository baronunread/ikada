import { Kbd } from "../../../src/components/kbd";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-1.5 text-sm text-fg-muted">
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
    <span className="ms-1">to search</span>
  </div>
);
