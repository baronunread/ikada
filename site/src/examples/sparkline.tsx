import { Sparkline } from "../../../src/charts/sparkline";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-56">
    <Sparkline ariaLabel="Requests" data={[12, 18, 15, 22, 28, 24, 31, 27, 35, 40, 36, 44]} />
  </div>
);
