import { StatusGlyph } from "../../../src/components/status-glyph";
import type { Example, Playground, Preview } from "./types";

const statuses = ["success", "warning", "danger", "info", "neutral"] as const;

export const examples: Example[] = [
  {
    title: "Shapes",
    description: "Circle, triangle, cross, half ring and square. Decorative: always pair a glyph with a label.",
    render: () => (
      <div className="flex items-center gap-3">
        <StatusGlyph status="success" />
        <StatusGlyph status="warning" />
        <StatusGlyph status="danger" />
        <StatusGlyph status="info" />
        <StatusGlyph status="neutral" />
      </div>
    ),
    code: `<StatusGlyph status="success" />
<StatusGlyph status="warning" />
<StatusGlyph status="danger" />
<StatusGlyph status="info" />
<StatusGlyph status="neutral" />`,
  },
  {
    title: "Live",
    description: "A bullseye for success that is serving traffic.",
    render: () => <StatusGlyph status="success" live />,
    code: `<StatusGlyph status="success" live />`,
  },
  {
    title: "Pulse",
    description: "While in progress. The half ring spins when motion is allowed.",
    render: () => (
      <div className="flex items-center gap-3">
        <StatusGlyph status="info" pulse />
        <StatusGlyph status="warning" pulse />
      </div>
    ),
    code: `<StatusGlyph status="info" pulse />
<StatusGlyph status="warning" pulse />`,
  },
  {
    title: "Sprout",
    description: "Grows up from its base and sends one ring out. Under reduced motion it fades in place.",
    render: () => <StatusGlyph status="success" sprout />,
    code: `<StatusGlyph status="success" sprout />`,
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
      status={v.status as (typeof statuses)[number]}
      live={Boolean(v.live)}
      pulse={Boolean(v.pulse)}
      sprout={Boolean(v.sprout)}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-3">
    <StatusGlyph status="success" />
    <StatusGlyph status="warning" />
    <StatusGlyph status="danger" />
    <StatusGlyph status="info" />
    <StatusGlyph status="neutral" />
  </div>
);
