import { RadioGroup } from "../../../src/components/radio-group";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <RadioGroup
    aria-label="Plan"
    defaultValue="free"
    options={[
      { value: "free", label: "Free" },
      { value: "pro", label: "Pro" },
    ]}
  />
);
