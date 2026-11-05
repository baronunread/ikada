import { Field } from "../../../src/components/field";
import { Textarea } from "../../../src/components/textarea";
import type { Example } from "./types";

export const examples: Example[] = [
  {
    title: "In a Field",
    render: () => (
      <Field label="Description" description="Shown on the project page.">
        <Textarea rows={3} placeholder="What this app does" />
      </Field>
    ),
  },
  {
    title: "Error",
    render: () => (
      <Field label="Query" error="Syntax error near FROM.">
        <Textarea mono rows={3} defaultValue="select * frm users" />
      </Field>
    ),
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="Notes">
        <Textarea disabled rows={2} defaultValue="Locked while deploying" />
      </Field>
    ),
  },
];
