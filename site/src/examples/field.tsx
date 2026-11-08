import { Field } from "../../../src/components/field";
import { Input } from "../../../src/components/input";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "With a hint",
    description: "The label and the hint are wired to the control, so screen readers read both.",
    render: () => (
      <Field label="Project name" description="Lowercase and dashes." className="max-w-72">
        <Input defaultValue="robin" />
      </Field>
    ),
    code: `<Field label="Project name" description="Lowercase and dashes.">
  <Input defaultValue="robin" />
</Field>`,
  },
  {
    title: "Required",
    description: "The asterisk is for sighted users; set required on the control for validation.",
    render: () => (
      <Field label="Domain" required className="max-w-72">
        <Input required placeholder="robin.sproutboat.app" />
      </Field>
    ),
    code: `<Field label="Domain" required>
  <Input required placeholder="robin.sproutboat.app" />
</Field>`,
  },
  {
    title: "Error",
    description: "A message makes the field invalid and is announced.",
    render: () => (
      <Field label="Domain" error="robin.sproutboat.app is already taken." className="max-w-72">
        <Input defaultValue="robin.sproutboat.app" />
      </Field>
    ),
    code: `<Field label="Domain" error="robin.sproutboat.app is already taken.">
  <Input defaultValue="robin.sproutboat.app" />
</Field>`,
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="Region" description="Fixed once the sprout exists." disabled className="max-w-72">
        <Input defaultValue="eu-west" disabled />
      </Field>
    ),
    code: `<Field label="Region" description="Fixed once the sprout exists." disabled>
  <Input defaultValue="eu-west" disabled />
</Field>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Field",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "description", kind: "text", default: "" },
    { prop: "error", kind: "text", default: "" },
    { prop: "required", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { label: "Project name", description: "Lowercase and dashes." },
  render: (v) => (
    <Field
      label={String(v.label)}
      description={v.description ? String(v.description) : undefined}
      error={v.error ? String(v.error) : undefined}
      required={Boolean(v.required)}
      disabled={Boolean(v.disabled)}
      className="max-w-72"
    >
      <Input defaultValue="robin" required={Boolean(v.required)} disabled={Boolean(v.disabled)} />
    </Field>
  ),
  code: (v) => {
    const props = [
      ` label="${String(v.label)}"`,
      v.description ? ` description="${String(v.description)}"` : "",
      v.error ? ` error="${String(v.error)}"` : "",
      v.required ? " required" : "",
      v.disabled ? " disabled" : "",
    ].join("");
    const input = [v.required ? " required" : "", v.disabled ? " disabled" : ""].join("");
    return `<Field${props}>\n  <Input defaultValue="robin"${input} />\n</Field>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Field label="Project name" description="Lowercase and dashes." className="w-60">
    <Input defaultValue="my-app" />
  </Field>
);
