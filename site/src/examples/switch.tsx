import { Switch } from "../../../src/components/switch";
import type { Example } from "./types";
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
        <Switch aria-label="Focused" className={forcedFocus} defaultChecked />
      </div>
    ),
  },
];
