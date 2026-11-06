import { Button } from "../../../src/components/button";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 items-end justify-between gap-3 border-b border-hairline pb-2">
    <div>
      <p className="text-xs text-fg-muted">acme / web</p>
      <p className="text-lg font-semibold">Overview</p>
    </div>
    <Button size="sm" variant="primary">
      Deploy
    </Button>
  </div>
);
