import { Switch } from "../../../src/components/switch";
import type { Example, Preview } from "./types";
import { forcedFocus } from "./types";

export const examples: Example[] = [
  {
    title: "States",
    description: "Press and hold: the thumb squishes toward its travel, then rides the snappy spring.",
    render: () => (
      <div className="flex flex-wrap items-center gap-5">
        <Switch label="Preview deployments" />
        <Switch label="Auto-promote" defaultChecked />
        <Switch label="Disabled" disabled />
        {/* The forced ring belongs on the track, so the label sits outside the component. */}
        <span className="inline-flex items-center gap-2.5 text-base text-fg">
          <Switch id="switch-example-focused" className={forcedFocus} defaultChecked />
          <label htmlFor="switch-example-focused">Focused</label>
        </span>
      </div>
    ),
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col gap-2">
    <Switch label="Auto-promote" defaultChecked />
    <Switch label="Preview builds" />
  </div>
);
