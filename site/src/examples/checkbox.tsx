import { Checkbox } from "../../../src/components/checkbox";
import type { Example, Playground, Preview } from "./types";

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
    code: `<Checkbox label="Unchecked" />
<Checkbox label="Checked" defaultChecked />
<Checkbox label="Mixed" indeterminate />
<Checkbox label="Disabled" disabled />
<Checkbox
  label="Run migrations first"
  description="Blocks the traffic shift until they pass."
/>`,
  },
  {
    title: "Invalid",
    render: () => <Checkbox label="I understand robin goes offline during the move" invalid />,
    code: `<Checkbox label="I understand robin goes offline during the move" invalid />`,
  },
  {
    title: "Without a label",
    description: "Pass aria-label so the box still has a name.",
    render: () => <Checkbox aria-label="Select wren" />,
    code: `<Checkbox aria-label="Select wren" />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Checkbox",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "description", kind: "text", default: "" },
    { prop: "defaultChecked", kind: "boolean", default: false },
    { prop: "indeterminate", kind: "boolean", default: false },
    { prop: "invalid", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { label: "Preview builds", description: "Build every pull request on its own URL.", defaultChecked: true },
  render: (v) => (
    // Keyed so changing defaultChecked takes effect: it only seeds the initial state.
    <Checkbox
      key={String(v.defaultChecked)}
      label={v.label ? String(v.label) : undefined}
      aria-label={v.label ? undefined : "Option"}
      description={v.description ? String(v.description) : undefined}
      defaultChecked={Boolean(v.defaultChecked)}
      indeterminate={Boolean(v.indeterminate)}
      invalid={Boolean(v.invalid)}
      disabled={Boolean(v.disabled)}
    />
  ),
  code: (v) => {
    const props = [
      v.label ? ` label="${String(v.label)}"` : ` aria-label="Option"`,
      v.description ? ` description="${String(v.description)}"` : "",
      v.defaultChecked ? " defaultChecked" : "",
      v.indeterminate ? " indeterminate" : "",
      v.invalid ? " invalid" : "",
      v.disabled ? " disabled" : "",
    ].join("");
    return `<Checkbox${props} />`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col gap-2">
    <Checkbox label="Preview builds" defaultChecked />
    <Checkbox label="Notify on failure" />
  </div>
);
