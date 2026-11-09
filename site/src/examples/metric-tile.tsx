import { Sparkline } from "../../../src/charts/sparkline";
import { MetricTile } from "../../../src/components/metric-tile";
import type { Example, Playground, Preview } from "./types";

const requests = [8, 11, 9, 14, 13, 17, 16, 21, 19, 24];
/** The ten points are the last ten hours, 14:00 to 23:00. */
const hour = (i: number): string => `${String(14 + i).padStart(2, "0")}:00`;

export const examples: Example[] = [
  {
    title: "Delta and trend",
    description: "The delta is a soft pill; the sparkline sits flush to the tile's bottom edge and marks now.",
    render: () => (
      <MetricTile
        label="Requests"
        value="1.28M"
        delta={{ value: "12%", direction: "up" }}
        hint="14.8 req/s average"
        sparkline={<Sparkline aria-label="Requests, last 10 hours" height={28} data={requests} formatPoint={hour} />}
        className="w-64"
      />
    ),
    code: `<MetricTile
  label="Requests"
  value="1.28M"
  delta={{ value: "12%", direction: "up" }}
  hint="14.8 req/s average"
  sparkline={<Sparkline aria-label="Requests, last 10 hours" height={28} data={[8, 11, 9, 14, 13, 17, 16, 21, 19, 24]} formatPoint={(i) => \`\${14 + i}:00\`} />}
/>`,
  },
  {
    title: "Sentiment",
    description: "A rise in requests is neither good nor bad. Say when the direction is news: error rate down is good.",
    render: () => (
      <>
        <MetricTile
          label="Error rate"
          value="0.21"
          unit="%"
          delta={{ value: "0.3 pt", direction: "down", sentiment: "good" }}
          className="w-52"
        />
        <MetricTile
          label="Latency"
          value="184"
          unit="ms p50"
          delta={{ value: "9%", direction: "up", sentiment: "bad" }}
          className="w-52"
        />
      </>
    ),
    code: `<MetricTile
  label="Error rate"
  value="0.21"
  unit="%"
  delta={{ value: "0.3 pt", direction: "down", sentiment: "good" }}
/>
<MetricTile
  label="Latency"
  value="184"
  unit="ms p50"
  delta={{ value: "9%", direction: "up", sentiment: "bad" }}
/>`,
  },
  {
    title: "Count",
    description: "Pass a raw number as amount and it is formatted compactly for the locale.",
    render: () => (
      <>
        <MetricTile label="Requests" amount={1_284_000} className="w-52" />
        <MetricTile label="Requests" amount={1_284_000} locale="de" className="w-52" />
      </>
    ),
    code: `<MetricTile label="Requests" amount={1284000} />
<MetricTile label="Requests" amount={1284000} locale="de" />`,
  },
  {
    title: "Loading",
    description: "A skeleton stands in for the value and the tile is marked aria-busy.",
    render: () => <MetricTile label="Requests" loading className="w-52" />,
    code: `<MetricTile label="Requests" loading />`,
  },
  {
    title: "No data",
    render: () => <MetricTile label="Requests" noData emptyText="No requests since the last deploy" className="w-52" />,
    code: `<MetricTile label="Requests" noData emptyText="No requests since the last deploy" />`,
  },
];

const deltas = ["none", "up", "down"] as const;
const sentiments = ["neutral", "good", "bad"] as const;

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "MetricTile",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "value", kind: "text", default: "" },
    { prop: "delta", kind: "select", options: deltas, default: "none" },
    { prop: "sentiment", kind: "select", options: sentiments, default: "neutral" },
    { prop: "loading", kind: "boolean", default: false },
    { prop: "noData", kind: "boolean", default: false },
  ],
  initial: { label: "Requests", value: "1.28M", delta: "up" },
  render: (v) => (
    <MetricTile
      label={String(v.label)}
      value={String(v.value)}
      delta={
        v.delta === "none"
          ? undefined
          : {
              value: "12%",
              direction: v.delta as "up" | "down",
              sentiment: v.sentiment as (typeof sentiments)[number],
            }
      }
      loading={Boolean(v.loading)}
      noData={Boolean(v.noData)}
      sparkline={<Sparkline aria-label="Requests, last 10 hours" height={28} data={requests} formatPoint={hour} />}
      className="w-64"
    />
  ),
  code: (v) => {
    const delta =
      v.delta === "none"
        ? ""
        : `\n  delta={{ value: "12%", direction: "${v.delta}"${v.sentiment !== "neutral" ? `, sentiment: "${v.sentiment}"` : ""} }}`;
    const flags = `${v.loading ? "\n  loading" : ""}${v.noData ? "\n  noData" : ""}`;
    return `<MetricTile\n  label="${v.label}"\n  value="${v.value}"${delta}${flags}\n  sparkline={<Sparkline aria-label="Requests, last 10 hours" data={requests} formatPoint={hour} />}\n/>`;
  },
};

/** The compact render on the overview's component tile. Not scaled with CSS zoom: the tooltip card is fixed-positioned and would land off the point. */
export const preview: Preview = () => (
  <MetricTile
    label="Requests"
    value="1.28M"
    delta={{ value: "12%", direction: "up" }}
    sparkline={<Sparkline aria-label="Requests, last 10 hours" height={28} data={requests} formatPoint={hour} />}
    className="w-44"
  />
);
