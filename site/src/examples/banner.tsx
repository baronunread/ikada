import { Banner } from "../../../src/components/banner";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Banner tone="warning" title="DNS pending" className="w-60">
    Add the CNAME record to finish.
  </Banner>
);
