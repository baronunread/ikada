import { Button } from "../../../src/components/button";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-start gap-2">
    <Button size="sm">Rollout</Button>
    <div className="w-52 rounded-xl bg-raised p-3 text-sm shadow-float">
      <p className="font-semibold">Rollout</p>
      <p className="text-fg-muted">Send 10% of traffic first.</p>
    </div>
  </div>
);
