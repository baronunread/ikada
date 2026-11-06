import { Meter } from "../../../src/components/meter";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-56 flex-col gap-3">
    <Meter label="Requests" value={62} />
    <Meter label="Storage" value={91} tone="warning" />
  </div>
);
