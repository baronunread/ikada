import { Checkbox } from "../../../src/components/checkbox";
import type { Example } from "./types";

export const examples: Example[] = [
  {
    title: "States",
    description: "A box bobs once as it fills. Checked is a solid green fill, 3:1 against the unchecked box.",
    render: () => (
      <div className="flex flex-wrap items-start gap-5">
        <Checkbox label="Unchecked" />
        <Checkbox label="Checked" defaultChecked />
        <Checkbox label="Mixed" indeterminate />
        <Checkbox label="Disabled" disabled />
        <Checkbox label="Run migrations first" description="Blocks the traffic shift until they pass." />
      </div>
    ),
  },
];
