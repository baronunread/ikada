import { StatusDot } from "../../../src/components/status-dot";
import type { Example, Playground, Preview } from "./types";

const statuses = ["success", "warning", "danger", "info", "neutral"] as const;

export const examples: Example[] = [
  {
    title: "Statuses",
    description: "Each status has its own shape, so colour is never the only signal.",
    render: () => (
      <div className="flex flex-col gap-2">
        <StatusDot status="success" label="Ready" />
        <StatusDot status="warning" label="DNS pending" />
        <StatusDot status="danger" label="Build failed" />
        <StatusDot status="info" label="Building" />
        <StatusDot status="neutral" label="Paused" />
      </div>
    ),
    code: `<StatusDot status="success" label="Ready" />
<StatusDot status="warning" label="DNS pending" />
<StatusDot status="danger" label="Build failed" />
<StatusDot status="info" label="Building" />
<StatusDot status="neutral" label="Paused" />`,
  },
  {
    title: "Live",
    description: "Success that is serving traffic gets its own bullseye, apart from the plain Ready circle.",
    render: () => <StatusDot status="success" live label="Live 90%" />,
    code: `<StatusDot status="success" live label="Live 90%" />`,
  },
  {
    title: "Pulse",
    description: "For in-progress states. The ring stops spinning when motion is reduced.",
    render: () => <StatusDot status="info" pulse label="Building" />,
    code: `<StatusDot status="info" pulse label="Building" />`,
  },
  {
    title: "Sprout",
    description: "Success that just happened: the shape grows up and sends one ring out.",
    render: () => <StatusDot status="success" sprout label="Deployed" />,
    code: `<StatusDot status="success" sprout label="Deployed" />`,
  },
  {
    title: "Hidden label",
    description: "Dense tables keep the label for screen readers and show only the shape.",
    render: () => <StatusDot status="danger" hideLabel label="Build failed" />,
    code: `<StatusDot status="danger" hideLabel label="Build failed" />`,
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
      status={v.status as (typeof statuses)[number]}
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
    <StatusDot status="success" label="Live" />
    <StatusDot status="warning" label="DNS pending" />
    <StatusDot status="danger" label="Build failed" />
  </div>
);
