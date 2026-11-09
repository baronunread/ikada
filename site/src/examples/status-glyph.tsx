import { StatusGlyph } from "../../../src/components/status-glyph";
import type { Example, Playground, Preview } from "./types";

const statuses = ["success", "warning", "danger", "info", "neutral"] as const;

export const examples: Example[] = [
  {
    title: "Shapes",
    description: "Circle, triangle, cross, half ring and square. Decorative: always pair a glyph with a label.",
    render: () => (
      <div className="flex items-center gap-3">
        <StatusGlyph tone="success" />
        <StatusGlyph tone="warning" />
        <StatusGlyph tone="danger" />
        <StatusGlyph tone="info" />
        <StatusGlyph tone="neutral" />
      </div>
    ),
    code: `<StatusGlyph tone="success" />
<StatusGlyph tone="warning" />
<StatusGlyph tone="danger" />
<StatusGlyph tone="info" />
<StatusGlyph tone="neutral" />`,
  },
  {
    title: "Live",
    description: "A bullseye for success that is serving traffic.",
    render: () => <StatusGlyph tone="success" live />,
    code: `<StatusGlyph tone="success" live />`,
  },
  {
    title: "Pulse",
    description: "While in progress. The half ring spins when motion is allowed.",
    render: () => (
      <div className="flex items-center gap-3">
        <StatusGlyph tone="info" pulse />
        <StatusGlyph tone="warning" pulse />
      </div>
    ),
    code: `<StatusGlyph tone="info" pulse />
<StatusGlyph tone="warning" pulse />`,
  },
  {
    title: "Sprout",
    description: "Grows up from its base and sends one ring out. Under reduced motion it fades in place.",
    render: () => <StatusGlyph tone="success" sprout />,
    code: `<StatusGlyph tone="success" sprout />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "StatusGlyph",
  controls: [
    { prop: "status", kind: "select", options: statuses },
    { prop: "live", kind: "boolean", default: false },
    { prop: "pulse", kind: "boolean", default: false },
    { prop: "sprout", kind: "boolean", default: false },
  ],
  initial: { status: "success" },
  render: (v) => (
    <StatusGlyph
      // sprout plays on mount, so a change remounts it.
      key={`${v.sprout}`}
      tone={v.status as (typeof statuses)[number]}
      live={Boolean(v.live)}
      pulse={Boolean(v.pulse)}
      sprout={Boolean(v.sprout)}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-3">
    <StatusGlyph tone="success" />
    <StatusGlyph tone="warning" />
    <StatusGlyph tone="danger" />
    <StatusGlyph tone="info" />
    <StatusGlyph tone="neutral" />
  </div>
);
