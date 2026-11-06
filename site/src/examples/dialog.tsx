import { Button } from "../../../src/components/button";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-60 flex-col gap-2 rounded-xl bg-raised p-4 shadow-float">
    <p className="font-semibold">Delete project?</p>
    <p className="text-sm text-fg-muted">This cannot be undone.</p>
    <div className="flex justify-end gap-2">
      <Button size="sm">Cancel</Button>
      <Button size="sm" variant="danger">
        Delete
      </Button>
    </div>
  </div>
);
