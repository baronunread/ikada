import { Button } from "../../../src/components/button";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-center gap-1.5">
    <span className="rounded-md bg-raised px-2 py-1 text-xs shadow-float">Roll back to v47</span>
    <Button size="sm">Roll back</Button>
  </div>
);
