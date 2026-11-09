import { TimeseriesChart } from "../../../src/charts/timeseries-chart";
import type { ChartColorName } from "../../../src/charts/theme";
import type { Example, Playground, Preview } from "./types";

const start = Date.UTC(2026, 10, 4);
const data = Array.from({ length: 48 }, (_, i) => ({
  time: start + i * 3_600_000,
  value: 120 + Math.round(60 * Math.sin(i / 6)) + i * 2,
}));

const dataConst = `const start = Date.UTC(2026, 10, 4);
const data = Array.from({ length: 48 }, (_, i) => ({
  time: start + i * 3_600_000, // one point an hour
  value: 120 + Math.round(60 * Math.sin(i / 6)) + i * 2,
}));`;

export const examples: Example[] = [
  {
    title: "Requests",
    render: () => (
      <div className="w-full">
        <TimeseriesChart
          aria-label="Requests, last 48 hours"
          series={[{ id: "req", label: "Requests", data }]}
          deploy={{ time: start + 30 * 3_600_000, label: "Deploy" }}
          height={220}
        />
      </div>
    ),
    code: `${dataConst}

<TimeseriesChart
  aria-label="Requests, last 48 hours"
  series={[{ id: "req", label: "Requests", data }]}
  deploy={{ time: start + 30 * 3_600_000, label: "Deploy" }}
  height={220}
/>`,
  },
  {
    title: "Two series",
    description: "Colour tokens and a dashed line tell series apart without relying on hue alone.",
    render: () => (
      <div className="w-full">
        <TimeseriesChart
          aria-label="Requests and errors, last 48 hours"
          series={[
            { id: "req", label: "Requests", data, area: true },
            {
              id: "err",
              label: "Errors",
              color: "errors",
              dashed: true,
              data: data.map((p) => ({ ...p, value: Math.round(p.value / 20) })),
            },
          ]}
          height={220}
        />
      </div>
    ),
    code: `${dataConst}

<TimeseriesChart
  aria-label="Requests and errors, last 48 hours"
  series={[
    { id: "req", label: "Requests", data, area: true },
    {
      id: "err",
      label: "Errors",
      color: "errors",
      dashed: true,
      data: data.map((p) => ({ ...p, value: Math.round(p.value / 20) })),
    },
  ]}
  height={220}
/>`,
  },
  {
    title: "No data",
    render: () => (
      <div className="w-full">
        <TimeseriesChart aria-label="Requests, last hour" series={[]} height={160} />
      </div>
    ),
    code: `<TimeseriesChart aria-label="Requests, last hour" series={[]} height={160} />`,
  },
];

const colors = ["requests", "errors", "deploy", "2xx", "3xx", "4xx", "5xx", "other", "series"] as const;

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "TimeseriesChart",
  controls: [
    { prop: "color", kind: "select", options: colors, default: "requests" },
    { prop: "height", kind: "number", min: 120, max: 360, step: 10, default: 210 },
    { prop: "area", kind: "boolean", default: false },
    { prop: "dashed", kind: "boolean", default: false },
    { prop: "deploy", kind: "boolean", default: false },
  ],
  initial: { area: true, deploy: true },
  render: (v) => (
    <div className="w-full">
      <TimeseriesChart
        aria-label="Requests, last 48 hours"
        series={[
          {
            id: "req",
            label: "Requests",
            data,
            color: v.color as ChartColorName,
            area: Boolean(v.area),
            dashed: Boolean(v.dashed),
          },
        ]}
        deploy={v.deploy ? { time: start + 30 * 3_600_000, label: "Deploy" } : undefined}
        height={Number(v.height)}
      />
    </div>
  ),
  code: (v) => {
    const series = [
      `id: "req", label: "Requests", data`,
      v.color !== "requests" ? `color: "${v.color}"` : "",
      v.area ? "area: true" : "",
      v.dashed ? "dashed: true" : "",
    ].filter(Boolean);
    const props = [
      `  ariaLabel="Requests, last 48 hours"`,
      `  series={[{ ${series.join(", ")} }]}`,
      v.deploy ? `  deploy={{ time: start + 30 * 3_600_000, label: "Deploy" }}` : "",
      v.height !== 210 ? `  height={${v.height}}` : "",
    ].filter(Boolean);
    return `${dataConst}\n\n<TimeseriesChart\n${props.join("\n")}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-60">
    <TimeseriesChart
      aria-label="Requests, last 48 hours"
      series={[{ id: "req", label: "Requests", data }]}
      deploy={{ time: start + 30 * 3_600_000, label: "Deploy" }}
      height={110}
    />
  </div>
);
