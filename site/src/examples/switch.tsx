import { Switch } from "../../../src/components/switch";
import type { Example, Playground, Preview } from "./types";
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
    code: `<Switch label="Preview deployments" />
<Switch label="Auto-promote" defaultChecked />
<Switch label="Disabled" disabled />
<Switch label="Focused" defaultChecked />`,
  },
  {
    title: "Without a label",
    description: "Without a visible label, pass aria-label.",
    render: () => <Switch aria-label="Maintenance mode" defaultChecked />,
    code: `<Switch aria-label="Maintenance mode" defaultChecked />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Switch",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "defaultChecked", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
    { prop: "required", kind: "boolean", default: false },
  ],
  initial: { label: "Auto-promote", defaultChecked: true },
  render: (v) => (
    <Switch
      // defaultChecked only applies on mount.
      key={`${v.defaultChecked}`}
      label={v.label ? String(v.label) : undefined}
      aria-label={v.label ? undefined : "Auto-promote"}
      defaultChecked={Boolean(v.defaultChecked)}
      disabled={Boolean(v.disabled)}
      required={Boolean(v.required)}
    />
  ),
  code: (v) => {
    const props = [
      v.label ? ` label="${v.label}"` : ` aria-label="Auto-promote"`,
      v.defaultChecked ? " defaultChecked" : "",
      v.disabled ? " disabled" : "",
      v.required ? " required" : "",
    ].join("");
    return `<Switch${props} />`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col gap-2">
    <Switch label="Auto-promote" defaultChecked />
    <Switch label="Preview builds" />
  </div>
);
