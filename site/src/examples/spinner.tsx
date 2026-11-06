import { Spinner } from "../../../src/components/spinner";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2 text-sm text-fg-muted">
    <Spinner decorative /> Deploying
  </div>
);
