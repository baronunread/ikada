import { Field } from "../../../src/components/field";
import { Textarea } from "../../../src/components/textarea";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "In a Field",
    render: () => (
      <Field label="Description" description="Shown on the project page.">
        <Textarea rows={3} placeholder="What this app does" />
      </Field>
    ),
    code: `<Field label="Description" description="Shown on the project page.">
  <Textarea rows={3} placeholder="What this app does" />
</Field>`,
  },
  {
    title: "Error",
    render: () => (
      <Field label="Query" error="Syntax error near FROM.">
        <Textarea mono rows={3} defaultValue="select * frm users" />
      </Field>
    ),
    code: `<Field label="Query" error="Syntax error near FROM.">
  <Textarea mono rows={3} defaultValue="select * frm users" />
</Field>`,
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="Notes">
        <Textarea disabled rows={2} defaultValue="Locked while deploying" />
      </Field>
    ),
    code: `<Field label="Notes">
  <Textarea disabled rows={2} defaultValue="Locked while deploying" />
</Field>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Textarea",
  controls: [
    { prop: "placeholder", kind: "text", default: "" },
    { prop: "rows", kind: "number", min: 2, max: 8, step: 1 },
    { prop: "mono", kind: "boolean", default: false },
    { prop: "invalid", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { placeholder: "What this app does", rows: 3 },
  fixed: { "aria-label": "Description" },
  render: (v) => (
    <Textarea
      aria-label="Description"
      placeholder={String(v.placeholder)}
      rows={Number(v.rows)}
      mono={Boolean(v.mono)}
      invalid={Boolean(v.invalid)}
      disabled={Boolean(v.disabled)}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Textarea aria-label="Query" mono rows={2} defaultValue={"select * from users\nlimit 10;"} className="w-60" />
);
