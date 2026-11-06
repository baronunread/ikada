import { Button } from "../../../src/components/button";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-fg-muted">Press again to delete</span>
    <Button size="sm" variant="danger">
      Delete
    </Button>
  </div>
);
