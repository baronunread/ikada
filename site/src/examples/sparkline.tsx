import { Sparkline } from "../../../src/charts/sparkline";
import type { ChartColorName } from "../../../src/charts/theme";
import type { Example, Playground, Preview } from "./types";

const requests = [12, 18, 15, 22, 28, 24, 31, 27, 35, 40, 36, 44];
const errors = [3, 2, 4, 3, 9, 14, 7, 5, 4, 3, 2, 2];

/** The twelve points are every second hour, 00:00 to 22:00. */
const hour = (i: number): string => `${String(i * 2).padStart(2, "0")}:00`;

const dataConst = `const requests = [12, 18, 15, 22, 28, 24, 31, 27, 35, 40, 36, 44];`;

export const examples: Example[] = [
  {
    title: "Default",
    description:
      "A trend with no axes and a dot on now. Hover for the value of the nearest point; formatPoint adds its time as a title.",
    render: () => (
      <div className="w-56">
        <Sparkline aria-label="Requests, last 24 hours" data={requests} formatPoint={hour} />
      </div>
    ),
    code: `${dataConst}

<Sparkline aria-label="Requests, last 24 hours" data={requests} formatPoint={(i) => \`\${String(i * 2).padStart(2, "0")}:00\`} />`,
  },
  {
    title: "Colour",
    description: "Any chart colour token. The same tokens colour TimeseriesChart.",
    render: () => (
      <div className="w-56">
        <Sparkline aria-label="Errors, last 24 hours" data={errors} color="errors" />
      </div>
    ),
    code: `const errors = [3, 2, 4, 3, 9, 14, 7, 5, 4, 3, 2, 2];

<Sparkline aria-label="Errors, last 24 hours" data={errors} color="errors" />`,
  },
  {
    title: "Line only",
    description: "Drop the fill and the current-point dot for the quietest form.",
    render: () => (
      <div className="w-56">
        <Sparkline aria-label="Requests, last 24 hours" data={requests} area={false} current={false} />
      </div>
    ),
    code: `<Sparkline aria-label="Requests, last 24 hours" data={requests} area={false} current={false} />`,
  },
  {
    title: "Fixed domain and height",
    description: "Pin the domain so several sparklines compare on one scale.",
    render: () => (
      <div className="w-56">
        <Sparkline aria-label="Requests, last 24 hours" data={requests} domain={[0, 100]} height={64} />
      </div>
    ),
    code: `<Sparkline aria-label="Requests, last 24 hours" data={requests} domain={[0, 100]} height={64} />`,
  },
];

const colors = ["requests", "errors", "deploy", "2xx", "3xx", "4xx", "5xx", "other", "series"] as const;

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Sparkline",
  controls: [
    { prop: "color", kind: "select", options: colors, default: "requests" },
    { prop: "height", kind: "number", min: 24, max: 96, step: 4, default: 40 },
    { prop: "area", kind: "boolean", default: true },
    { prop: "current", kind: "boolean", default: true },
  ],
  render: (v) => (
    <div className="w-56">
      <Sparkline
        aria-label="Requests, last 24 hours"
        data={requests}
        formatPoint={hour}
        color={v.color as ChartColorName}
        height={Number(v.height)}
        area={Boolean(v.area)}
        current={Boolean(v.current)}
      />
    </div>
  ),
  code: (v) => {
    const props = [
      `  ariaLabel="Requests, last 24 hours"`,
      `  data={requests}`,
      v.color !== "requests" ? `  color="${v.color}"` : "",
      v.height !== 40 ? `  height={${v.height}}` : "",
      v.area ? "" : "  area={false}",
      v.current ? "" : "  current={false}",
    ].filter(Boolean);
    return `${dataConst}\n\n<Sparkline\n${props.join("\n")}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-56">
    <Sparkline aria-label="Requests" data={requests} />
  </div>
);
