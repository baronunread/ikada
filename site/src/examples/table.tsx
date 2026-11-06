import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-60 text-sm">
    <div className="flex border-b border-hairline py-1.5 text-fg-muted">
      <span className="flex-1">Version</span>
      <span>Status</span>
    </div>
    <div className="flex border-b border-hairline py-1.5">
      <span className="flex-1">v48</span>
      <span className="text-brand-fg">Live</span>
    </div>
    <div className="flex py-1.5">
      <span className="flex-1">v47</span>
      <span className="text-fg-muted">Ready</span>
    </div>
  </div>
);
