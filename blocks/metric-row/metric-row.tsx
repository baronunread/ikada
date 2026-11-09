/**
 * A row of headline numbers for the last 24 hours: requests, error rate, response time and
 * sprouts serving, each with its change and an hourly sparkline. Two columns when narrow, four when wide.
 */
import { Sparkline } from "../../src/charts/sparkline";
import type { ChartColorName } from "../../src/charts/theme";
import { MetricTile } from "../../src/components/metric-tile";
import type { MetricDelta } from "../../src/components/metric-tile";
import { cn } from "../../src/lib/cn";

export interface Metric {
  id: string;
  label: string;
  /** Already formatted: "184K", "0.21". */
  value: string;
  /** "%", "ms p50", "of 6". */
  unit?: string;
  delta?: MetricDelta;
  /** One line under the value. */
  hint?: string;
  /** Hourly values, oldest first; draws a sparkline under the tile. */
  trend?: readonly number[];
  trendColor?: ChartColorName;
  /** How a hovered sparkline value reads: the number (and a unit if it has one), not the series name, which the tooltip shows once. */
  formatTrend?: (value: number) => string;
}

export interface MetricRowProps {
  metrics?: Metric[];
  /** Labels a sparkline point by its index, e.g. the hour it covers. */
  formatPoint?: (index: number) => string;
  className?: string;
}

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

/** 24 hourly values on a day curve: quiet at night, busiest mid-afternoon. */
function day(peak: number, seed: number, floor = 0.18): number[] {
  const rand = seeded(seed);
  return Array.from({ length: 24 }, (_, h) => {
    const curve = floor + (1 - floor) * Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.5 + 0.5) ** 1.6;
    return Math.round(peak * curve * (0.85 + rand() * 0.3));
  });
}

const requests = day(12_400, 7);
const errors = requests.map((r, h) => Math.round(r * (h === 15 || h === 16 ? 0.011 : 0.0016)));
const latency = day(64, 11, 0.55);

/** Sample data: a busy project's last 24 hours, with a short error spike after an afternoon deploy. */
export const sampleMetrics: Metric[] = [
  {
    id: "requests",
    label: "Requests",
    value: "184K",
    delta: { value: "12%", direction: "up" },
    hint: "Last 24 hours",
    trend: requests,
    formatTrend: (v) => v.toLocaleString("en"),
  },
  {
    id: "errors",
    label: "Error rate",
    value: "0.21",
    unit: "%",
    delta: { value: "0.08 pt", direction: "up", sentiment: "bad" },
    hint: "5xx responses",
    trend: errors,
    trendColor: "errors",
    formatTrend: (v) => String(v),
  },
  {
    id: "latency",
    label: "Response time",
    value: "38",
    unit: "ms p50",
    delta: { value: "9%", direction: "down", sentiment: "good" },
    hint: "p99 212 ms",
    trend: latency,
    trendColor: "series",
    formatTrend: (v) => `${v} ms`,
  },
  {
    id: "serving",
    label: "Sprouts serving",
    value: "5",
    unit: "of 6",
    hint: "One paused",
  },
];

const hourLabel = (i: number): string => `${String(i).padStart(2, "0")}:00`;

export function MetricRow({ metrics = sampleMetrics, formatPoint = hourLabel, className }: MetricRowProps) {
  return (
    <div className={cn("@container", className)}>
      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2 @4xl:grid-cols-4">
        {metrics.map((m) => (
          <MetricTile
            key={m.id}
            className="justify-between"
            label={m.label}
            value={m.value}
            unit={m.unit}
            delta={m.delta}
            hint={m.hint}
            sparkline={
              m.trend ? (
                <Sparkline
                  data={m.trend}
                  color={m.trendColor}
                  aria-label={`${m.label}, per hour over the last 24 hours`}
                  formatValue={m.formatTrend}
                  formatPoint={formatPoint}
                />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
