import { SensitiveInput } from "../../../src/components/sensitive-input";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <SensitiveInput aria-label="Token" defaultValue="sb_live_2f9a" mono className="w-60" />
);
