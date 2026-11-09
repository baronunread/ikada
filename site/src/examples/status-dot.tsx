import { StatusDot } from "../../../src/components/status-dot";
import type { Example, Playground, Preview } from "./types";

const statuses = ["success", "warning", "danger", "info", "neutral"] as const;

export const examples: Example[] = [
  {
    title: "Statuses",
    description: "Each status has its own shape, so colour is never the only signal.",
    render: () => (
      <div className="flex flex-col gap-2">
        <StatusDot tone="success" label="Ready" />
        <StatusDot tone="warning" label="DNS pending" />
        <StatusDot tone="danger" label="Build failed" />
        <StatusDot tone="info" label="Building" />
        <StatusDot tone="neutral" label="Paused" />
      </div>
    ),
    code: `<StatusDot tone="success" label="Ready" />
<StatusDot tone="warning" label="DNS pending" />
<StatusDot tone="danger" label="Build failed" />
<StatusDot tone="info" label="Building" />
<StatusDot tone="neutral" label="Paused" />`,
  },
  {
    title: "Live",
    description: "Success that is serving traffic gets its own bullseye, apart from the plain Ready circle.",
    render: () => <StatusDot tone="success" live label="Live 90%" />,
    code: `<StatusDot tone="success" live label="Live 90%" />`,
  },
  {
    title: "Pulse",
    description: "For in-progress states. The ring stops spinning when motion is reduced.",
    render: () => <StatusDot tone="info" pulse label="Building" />,
    code: `<StatusDot tone="info" pulse label="Building" />`,
  },
  {
    title: "Sprout",
    description: "Success that just happened: the shape grows up and sends one ring out.",
    render: () => <StatusDot tone="success" sprout label="Deployed" />,
    code: `<StatusDot tone="success" sprout label="Deployed" />`,
  },
  {
    title: "Hidden label",
    description: "Dense tables keep the label for screen readers and show only the shape.",
    render: () => <StatusDot tone="danger" hideLabel label="Build failed" />,
    code: `<StatusDot tone="danger" hideLabel label="Build failed" />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "StatusDot",
  controls: [
    { prop: "status", kind: "select", options: statuses },
    { prop: "label", kind: "text" },
    { prop: "live", kind: "boolean", default: false },
    { prop: "pulse", kind: "boolean", default: false },
    { prop: "sprout", kind: "boolean", default: false },
    { prop: "hideLabel", kind: "boolean", default: false },
  ],
  initial: { status: "success", label: "Ready" },
  render: (v) => (
    <StatusDot
      // sprout plays on mount, so a change remounts it.
      key={`${v.sprout}`}
      tone={v.status as (typeof statuses)[number]}
      label={String(v.label)}
      live={Boolean(v.live)}
      pulse={Boolean(v.pulse)}
      sprout={Boolean(v.sprout)}
      hideLabel={Boolean(v.hideLabel)}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col gap-1.5">
    <StatusDot tone="success" label="Live" />
    <StatusDot tone="warning" label="DNS pending" />
    <StatusDot tone="danger" label="Build failed" />
  </div>
);
