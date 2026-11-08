import { Input } from "../../../src/components/input";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Default",
    description: "Give it a name with a Field label, or aria-label when the context already labels it.",
    render: () => <Input aria-label="Domain" placeholder="robin.sproutboat.app" className="max-w-72" />,
    code: `<Input aria-label="Domain" placeholder="robin.sproutboat.app" />`,
  },
  {
    title: "Monospace",
    description: "For ids, keys and hashes.",
    render: () => <Input aria-label="Deploy ID" mono defaultValue="dpl_8f3a91c2" className="max-w-72" />,
    code: `<Input aria-label="Deploy ID" mono defaultValue="dpl_8f3a91c2" />`,
  },
  {
    title: "Invalid",
    description: "A danger ring and aria-invalid. Prefer the error on a Field, which also announces the message.",
    render: () => <Input aria-label="Domain" invalid defaultValue="robin sproutboat" className="max-w-72" />,
    code: `<Input aria-label="Domain" invalid defaultValue="robin sproutboat" />`,
  },
  {
    title: "Read only",
    render: () => <Input aria-label="Region" readOnly defaultValue="eu-west" className="max-w-72" />,
    code: `<Input aria-label="Region" readOnly defaultValue="eu-west" />`,
  },
  {
    title: "Disabled",
    render: () => <Input aria-label="Region" disabled defaultValue="eu-west" className="max-w-72" />,
    code: `<Input aria-label="Region" disabled defaultValue="eu-west" />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Input",
  controls: [
    { prop: "placeholder", kind: "text", default: "" },
    { prop: "mono", kind: "boolean", default: false },
    { prop: "invalid", kind: "boolean", default: false },
    { prop: "readOnly", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { placeholder: "robin.sproutboat.app" },
  fixed: { "aria-label": "Domain" },
  render: (v) => (
    <Input
      aria-label="Domain"
      placeholder={v.placeholder ? String(v.placeholder) : undefined}
      mono={Boolean(v.mono)}
      invalid={Boolean(v.invalid)}
      readOnly={Boolean(v.readOnly)}
      disabled={Boolean(v.disabled)}
      className="max-w-72"
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <Input aria-label="Domain" placeholder="docs.example.com" className="w-60" />;
