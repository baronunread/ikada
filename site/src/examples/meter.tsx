import { Meter, UsageMeter } from "../../../src/components/meter";
import type { Example, Playground, Preview } from "./types";

const tones = ["normal", "warning", "danger"] as const;

export const examples: Example[] = [
  {
    title: "Tones",
    description: "Normal, warning (amber) and danger (red). The fill grows over 250ms.",
    render: () => (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Meter label="Requests" value={42} />
        <Meter label="Storage" value={85} tone="warning" />
        <Meter label="Build minutes" value={100} tone="danger" />
      </div>
    ),
    code: `<Meter label="Requests" value={42} />
<Meter label="Storage" value={85} tone="warning" />
<Meter label="Build minutes" value={100} tone="danger" />`,
  },
  {
    title: "Usage against a plan limit",
    description:
      "Amber from 80% and at 100%; red only when the platform is actually refusing work (blocked). The state is written out too.",
    render: () => (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <UsageMeter label="Requests" used={860_000} limit={1_000_000} />
        <UsageMeter label="Storage" used={4.4} limit={5} unit="GB" />
        <UsageMeter label="Deploys" used={100} limit={100} blocked />
        <UsageMeter label="Sprouts" used={4} limit={null} />
      </div>
    ),
    code: `<UsageMeter label="Requests" used={860_000} limit={1_000_000} />
<UsageMeter label="Storage" used={4.4} limit={5} unit="GB" />
<UsageMeter label="Deploys" used={100} limit={100} blocked />
<UsageMeter label="Sprouts" used={4} limit={null} />`,
  },
  {
    title: "Without a visible label",
    description: "Pass aria-label, and valueLabel={null} to drop the number as well.",
    render: () => <Meter aria-label="wren CPU" value={64} valueLabel={null} className="w-full max-w-sm" />,
    code: `<Meter aria-label="wren CPU" value={64} valueLabel={null} />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Meter",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "value", kind: "number", min: 0, max: 100, step: 1 },
    { prop: "tone", kind: "select", options: tones, default: "normal" },
  ],
  initial: { label: "Requests", value: 62 },
  render: (v) => (
    <Meter
      label={v.label ? String(v.label) : undefined}
      aria-label={v.label ? undefined : "Usage"}
      value={Number(v.value)}
      tone={v.tone as (typeof tones)[number]}
      className="w-full max-w-sm"
    />
  ),
  code: (v) => {
    const props = [
      v.label ? ` label="${String(v.label)}"` : ` aria-label="Usage"`,
      ` value={${Number(v.value)}}`,
      v.tone !== "normal" ? ` tone="${v.tone}"` : "",
    ].join("");
    return `<Meter${props} />`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-56 flex-col gap-3">
    <Meter label="Requests" value={62} />
    <Meter label="Storage" value={91} tone="warning" />
  </div>
);
