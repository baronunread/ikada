import { Button } from "../../../src/components/button";
import { Spinner } from "../../../src/components/spinner";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Sizes",
    render: () => (["sm", "md", "lg"] as const).map((s) => <Spinner key={s} size={s} />),
    code: `<Spinner size="sm" />
<Spinner />
<Spinner size="lg" />`,
  },
  {
    title: "Labelled",
    description: "The label is announced politely. Say what is loading.",
    render: () => <Spinner label="Deploying robin" />,
    code: `<Spinner label="Deploying robin" />`,
  },
  {
    title: "Decorative",
    description: "When the parent already says it, hide the spinner from assistive tech.",
    render: () => (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner decorative /> Deploying
      </div>
    ),
    code: `<div className="flex items-center gap-2 text-sm text-fg-muted">
  <Spinner decorative /> Deploying
</div>`,
  },
  {
    title: "In a button",
    description: "Button's own loading prop already draws one; this is for custom layouts.",
    render: () => (
      <Button disabled aria-busy="true">
        <Spinner decorative size="sm" /> Planting wren
      </Button>
    ),
    code: `<Button disabled aria-busy="true">
  <Spinner decorative size="sm" /> Planting wren
</Button>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Spinner",
  controls: [
    { prop: "size", kind: "select", options: ["sm", "md", "lg"], default: "md" },
    { prop: "label", kind: "text", default: "Loading" },
    { prop: "decorative", kind: "boolean", default: false },
  ],
  initial: { size: "lg" },
  render: (v) => (
    <Spinner size={v.size as "sm" | "md" | "lg"} label={String(v.label)} decorative={Boolean(v.decorative)} />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2 text-sm text-fg-muted">
    <Spinner decorative /> Deploying
  </div>
);
