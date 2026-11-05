import { useState } from "react";
import { Field } from "../../../src/components/field";
import { Select } from "../../../src/components/select";
import type { Example } from "./types";

const regions = [
  { value: "fra", label: "Frankfurt" },
  { value: "iad", label: "Virginia" },
  { value: "sin", label: "Singapore", disabled: true },
];

function Controlled() {
  const [value, setValue] = useState<string | null>("fra");
  return (
    <Field label="Region" className="max-w-64">
      <Select options={regions} value={value} onValueChange={setValue} />
    </Field>
  );
}

export const examples: Example[] = [
  { title: "Default", render: () => <Controlled /> },
  {
    title: "Placeholder",
    render: () => (
      <Field label="Region" className="max-w-64">
        <Select options={regions} placeholder="Pick a region" />
      </Field>
    ),
  },
  {
    title: "Error",
    render: () => (
      <Field label="Region" error="Pick a region." className="max-w-64">
        <Select options={regions} />
      </Field>
    ),
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="Region" className="max-w-64">
        <Select options={regions} defaultValue="fra" disabled />
      </Field>
    ),
  },
];
