import { TimeseriesChart } from "../../../src/charts/timeseries-chart";
import type { Example } from "./types";

const start = Date.UTC(2026, 10, 4);
const data = Array.from({ length: 48 }, (_, i) => ({
  time: start + i * 3_600_000,
  value: 120 + Math.round(60 * Math.sin(i / 6)) + i * 2,
}));

export const examples: Example[] = [
  {
    title: "Requests",
    render: () => (
      <div className="w-full">
        <TimeseriesChart
          ariaLabel="Requests, last 48 hours"
          series={[{ id: "req", label: "Requests", data }]}
          deploy={{ time: start + 30 * 3_600_000, label: "Deploy" }}
          height={220}
        />
      </div>
    ),
  },
];
