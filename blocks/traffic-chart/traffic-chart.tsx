/**
 * Requests and 5xx errors over time with deploys marked as dashed rules, a range switch (hour,
 * day, week), the range's totals and a legend that names every line, so colour is never the only key.
 */
import { useMemo, useState } from "react";
import { chartColors } from "../../src/charts/theme";
import type { ChartColorName } from "../../src/charts/theme";
import { TimeseriesChart } from "../../src/charts/timeseries-chart";
import type { DeployMarker, TimeseriesPoint } from "../../src/charts/timeseries-chart";
import { SegmentedControl } from "../../src/components/segmented-control";
import { cn } from "../../src/lib/cn";
import { formatCompact } from "../../src/lib/format";

export type TrafficRange = "1h" | "24h" | "7d";

export interface TrafficData {
  requests: TimeseriesPoint[];
  errors: TimeseriesPoint[];
  deploys: DeployMarker[];
}

export interface TrafficChartProps {
  /** The data for a range. Defaults to generated sample traffic. */
  data?: (range: TrafficRange) => TrafficData;
  /** The range shown first. */
  defaultRange?: TrafficRange;
  onRangeChange?: (range: TrafficRange) => void;
  title?: string;
  className?: string;
}

const RANGES = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
] as const satisfies readonly { value: TrafficRange; label: string }[];

const RANGE_TEXT: Record<TrafficRange, string> = { "1h": "last hour", "24h": "last 24 hours", "7d": "last 7 days" };

/** Deterministic noise, so the sample looks real and renders the same every time. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** The sample's "now": a weekday afternoon. */
const NOW = Date.UTC(2026, 10, 5, 15, 0);

/** Traffic on a day curve (busiest mid-afternoon UTC) with a burst of 5xx between a bad deploy and its fix. */
function sample(range: TrafficRange): TrafficData {
  const spec = {
    "1h": { points: 60, step: MINUTE, perStep: 140 },
    "24h": { points: 48, step: HOUR / 2, perStep: 4_200 },
    "7d": { points: 56, step: 3 * HOUR, perStep: 24_000 },
  }[range];
  const rand = seeded(range.length * 97 + spec.points);
  const start = NOW - (spec.points - 1) * spec.step;
  const badDeploy = NOW - spec.step * Math.round(spec.points * 0.42);
  const fixDeploy = badDeploy + spec.step * Math.max(3, Math.round(spec.points * 0.16));
  const requests: TimeseriesPoint[] = [];
  const errors: TimeseriesPoint[] = [];
  for (let i = 0; i < spec.points; i++) {
    const time = start + i * spec.step;
    const hour = new Date(time).getUTCHours() + new Date(time).getUTCMinutes() / 60;
    const curve = 0.25 + 0.75 * (Math.sin(((hour - 8) / 24) * Math.PI * 2) * 0.5 + 0.5) ** 1.4;
    const weekend = range === "7d" && [0, 6].includes(new Date(time).getUTCDay()) ? 0.62 : 1;
    const value = Math.round(spec.perStep * curve * weekend * (0.88 + rand() * 0.24));
    const broken = time >= badDeploy && time < fixDeploy;
    requests.push({ time, value });
    errors.push({ time, value: Math.round(value * (broken ? 0.11 + rand() * 0.05 : 0.002 + rand() * 0.002)) });
  }
  return {
    requests,
    errors,
    deploys: [
      { time: badDeploy, label: range === "7d" ? "v46" : "v47" },
      { time: fixDeploy, label: range === "7d" ? "v47" : "v48" },
    ],
  };
}

const LEGEND: { label: string; color: ChartColorName; dashed?: boolean }[] = [
  { label: "Requests", color: "requests" },
  { label: "Errors (5xx)", color: "errors" },
  { label: "Deploy", color: "deploy", dashed: true },
];

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
      {LEGEND.map((entry) => (
        <li key={entry.label} className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="16" height="8" viewBox="0 0 16 8" className="shrink-0">
            <line
              x1="1"
              y1="4"
              x2="15"
              y2="4"
              style={{ stroke: chartColors[entry.color] }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={entry.dashed ? "2 3" : undefined}
            />
          </svg>
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

export function TrafficChart({
  data = sample,
  defaultRange = "24h",
  onRangeChange,
  title = "Traffic",
  className,
}: TrafficChartProps) {
  const [range, setRange] = useState<TrafficRange>(defaultRange);
  const traffic = useMemo(() => data(range), [data, range]);
  const total = traffic.requests.reduce((sum, p) => sum + p.value, 0);
  const failed = traffic.errors.reduce((sum, p) => sum + p.value, 0);
  const rate = total ? (failed / total) * 100 : 0;
  return (
    <section
      aria-labelledby="traffic-title"
      className={cn("@container flex flex-col gap-4 rounded-xl bg-surface p-4 text-fg shadow-card @lg:p-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="traffic-title" className="text-md font-semibold">
            {title}
          </h2>
          <p className="text-sm text-fg-muted" aria-live="polite">
            <span className="font-semibold text-fg tabular-nums">
              {formatCompact(total, { maximumFractionDigits: 1 })}
            </span>{" "}
            requests ·{" "}
            <span className={cn("font-semibold tabular-nums", rate >= 1 ? "text-danger-fg" : "text-fg")}>
              {rate.toFixed(2)}%
            </span>{" "}
            errors, {RANGE_TEXT[range]}
          </p>
        </div>
        <SegmentedControl
          aria-label="Time range"
          size="sm"
          value={range}
          options={RANGES}
          onValueChange={(next) => {
            setRange(next);
            onRangeChange?.(next);
          }}
          className="@md:w-72"
        />
      </div>
      <TimeseriesChart
        ariaLabel={`Requests and 5xx errors, ${RANGE_TEXT[range]}`}
        series={[
          { id: "requests", label: "Requests", data: traffic.requests, area: true },
          { id: "errors", label: "Errors", color: "errors", data: traffic.errors },
        ]}
        deploy={traffic.deploys}
        height={220}
      />
      <Legend />
    </section>
  );
}
