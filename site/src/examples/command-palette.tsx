import { Kbd } from "../../../src/components/kbd";
import { SearchIcon } from "../../../src/lib/icons";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 items-center gap-2 rounded-xl bg-raised px-3 py-2.5 text-sm text-fg-muted shadow-float">
    <SearchIcon />
    <span className="flex-1">Search projects…</span>
    <Kbd>⌘K</Kbd>
  </div>
);
