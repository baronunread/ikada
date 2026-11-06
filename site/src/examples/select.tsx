import { useState } from "react";
import { Field } from "../../../src/components/field";
import { Select } from "../../../src/components/select";
import type { Example, Playground, Preview } from "./types";

const regions = [
  { value: "eu-west", label: "eu-west" },
  { value: "us-east", label: "us-east" },
  { value: "ap-south", label: "ap-south", disabled: true },
];

function Controlled() {
  const [value, setValue] = useState<string | null>("eu-west");
  return (
    <Field label="Region" className="max-w-64">
      <Select options={regions} value={value} onValueChange={setValue} />
    </Field>
  );
}

const regionsConst = `const regions = [
  { value: "eu-west", label: "eu-west" },
  { value: "us-east", label: "us-east" },
  { value: "ap-south", label: "ap-south", disabled: true },
];`;

export const examples: Example[] = [
  {
    title: "Default",
    render: () => <Controlled />,
    code: `${regionsConst}

const [value, setValue] = useState<string | null>("eu-west");

<Field label="Region">
  <Select options={regions} value={value} onValueChange={setValue} />
</Field>`,
  },
  {
    title: "Placeholder",
    render: () => (
      <Field label="Region" className="max-w-64">
        <Select options={regions} placeholder="Pick a region" />
      </Field>
    ),
    code: `<Field label="Region">
  <Select options={regions} placeholder="Pick a region" />
</Field>`,
  },
  {
    title: "Error",
    render: () => (
      <Field label="Region" error="Pick a region." className="max-w-64">
        <Select options={regions} />
      </Field>
    ),
    code: `<Field label="Region" error="Pick a region.">
  <Select options={regions} />
</Field>`,
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="Region" className="max-w-64">
        <Select options={regions} defaultValue="eu-west" disabled />
      </Field>
    ),
    code: `<Field label="Region">
  <Select options={regions} defaultValue="eu-west" disabled />
</Field>`,
  },
];

const initialChoices = ["none", "eu-west", "us-east"] as const;

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Select",
  controls: [
    { prop: "initial", kind: "select", options: initialChoices, default: "none" },
    { prop: "placeholder", kind: "text", default: "Select..." },
    { prop: "invalid", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { initial: "eu-west" },
  render: (v) => (
    <Select
      // Remounts when the starting choice changes: the control is uncontrolled.
      key={String(v.initial)}
      aria-label="Region"
      options={regions}
      defaultValue={v.initial === "none" ? undefined : String(v.initial)}
      placeholder={String(v.placeholder)}
      invalid={Boolean(v.invalid)}
      disabled={Boolean(v.disabled)}
      className="max-w-64"
    />
  ),
  code: (v) => {
    const props = [
      `  aria-label="Region"`,
      `  options={regions}`,
      v.initial !== "none" ? `  defaultValue="${v.initial}"` : "",
      v.placeholder !== "Select..." ? `  placeholder="${v.placeholder}"` : "",
      v.invalid ? "  invalid" : "",
      v.disabled ? "  disabled" : "",
    ].filter(Boolean);
    return `<Select\n${props.join("\n")}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Select aria-label="Region" options={regions} defaultValue="eu-west" className="w-48" />
);
