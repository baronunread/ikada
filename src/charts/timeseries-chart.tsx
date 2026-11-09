"use client";

import { areaY, defineChart, lineY, ruleX, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { decorative } from "@tanstack/charts/mark/decorative";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { formatCompact, formatNumber } from "../lib/format";
import { useLocale } from "../lib/locale";
import { accessibleName } from "../lib/accessible-name";
import type { AccessibleName } from "../lib/accessible-name";
import { chartClassName, chartColors } from "./theme";
import type { ChartColorName } from "./theme";

export interface TimeseriesPoint {
  /** Any number on one shared axis: epoch milliseconds, or hours since midnight. */
  time: number;
  value: number;
}

export interface TimeseriesSeries {
  id: string;
  /** Shown in the tooltip and read by screen readers. */
  label: string;
  data: readonly TimeseriesPoint[];
  /** A chart color token name. Defaults to `requests`. */
  color?: ChartColorName;
  /** Fills under the line with the same color at 14% opacity. */
  area?: boolean;
  dashed?: boolean;
}

export interface DeployMarker {
  time: number;
  /** Short label printed beside the rule, e.g. "v48". */
  label: string;
}

export interface TimeseriesChartBase {
  /** The lines to draw: a label, a colour and the points of each. */
  series: readonly TimeseriesSeries[];
  /** A dashed vertical rule with a label, in the `chart-deploy` color. */
  deploy?: DeployMarker | readonly DeployMarker[];
  /** Height in pixels. Default 210; the width fills the container. */
  height?: number;
  /** [min, max] of the value axis. Defaults to 0 up to the largest value, rounded up. */
  yDomain?: readonly [number, number];
  /** Time range in ms [from, to]. Defaults to the span of the data. */
  xDomain?: readonly [number, number];
  /**
   * Formats x ticks and the tooltip heading. Defaults to clock times ("14:30") for epoch
   * milliseconds spanning up to two days, dates ("Nov 5") beyond that, and plain numbers otherwise.
   */
  formatTime?: (time: number) => string;
  /** Number and date locale; defaults to the `LocaleProvider` value, else `en`. */
  locale?: string;
  /** Shown in place of the plot when no series has a point. */
  emptyText?: string;
  /** Formats y ticks and tooltip values. */
  formatValue?: (value: number) => string;
  /** Formats y axis ticks. Defaults to compact numbers (1.5K) with no unit, so labels stay narrow. */
  formatTick?: (value: number) => string;
  /** Approximate number of x ticks. Defaults to 5. */
  xTicks?: number;
  /** About how many value ticks to draw. Default 4. */
  yTicks?: number;
  className?: string;
}

interface Row {
  time: number;
  value: number;
  label: string;
}

const compact = (value: number): string => formatCompact(value, { maximumFractionDigits: 1 });

const defaultValue = (value: number): string => formatNumber(value);

/** Epoch milliseconds from 2001 on; smaller numbers are treated as plain values (hours, indexes). */
const EPOCH_MS_FLOOR = 978_307_200_000;
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

/** The default x formatter for a domain: clock time, date, or a plain number. */
export function timeFormatter(domain: readonly [number, number], locale = "en"): (time: number) => string {
  const [x0, x1] = domain;
  if (!isEpoch(domain)) return (time) => formatNumber(time, { locale });
  const format =
    x1 - x0 <= TWO_DAYS
      ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return (time) => format.format(time);
}

const MINUTE = 60_000;
const TIME_STEPS = [1, 5, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((m) => m * MINUTE);

const isEpoch = ([x0, x1]: readonly [number, number]): boolean => x0 >= EPOCH_MS_FLOOR && x1 >= EPOCH_MS_FLOOR;

/**
 * Tick positions on whole clock units (on the hour, at local midnight) for an epoch-millisecond
 * domain, at most about `count` of them. Returns undefined for plain numbers (the scale picks).
 */
export function timeTicks(domain: readonly [number, number], count = 5): number[] | undefined {
  if (!isEpoch(domain)) return undefined;
  const [x0, x1] = domain;
  const step = TIME_STEPS.find((s) => (x1 - x0) / s <= count) ?? TIME_STEPS[TIME_STEPS.length - 1]!;
  // Align to local wall-clock units, not UTC ones.
  const tz = -new Date(x0).getTimezoneOffset() * MINUTE;
  const first = Math.ceil((x0 + tz) / step) * step - tz;
  const ticks: number[] = [];
  for (let t = first; t <= x1; t += step) ticks.push(t);
  return ticks;
}

const markers = (deploy: TimeseriesChartProps["deploy"]): readonly DeployMarker[] =>
  deploy === undefined ? [] : "time" in deploy ? [deploy] : deploy;

/** Props of {@link TimeseriesChart}. The accessible name is `aria-label`; `ariaLabel` is deprecated. */
export type TimeseriesChartProps = TimeseriesChartBase & AccessibleName;

/**
 * A line (and optional area) chart on TanStack Charts, themed by the chart tokens:
 * grid and tooltip follow light and dark, and the deploy marker is a dashed rule
 * so a before and after read at a glance. Epoch-millisecond times read as clock times
 * or dates; with no points at all it keeps its height and says so instead of plotting.
 */
export function TimeseriesChart({
  series,
  deploy,
  "aria-label": ariaLabelStd,
  ariaLabel: ariaLabelLegacy,
  height = 210,
  yDomain,
  xDomain,
  formatTime,
  formatValue = defaultValue,
  formatTick = compact,
  xTicks = 5,
  yTicks = 4,
  locale,
  emptyText = "No data for this range",
  className,
}: TimeseriesChartProps) {
  const ariaLabel = accessibleName({ "aria-label": ariaLabelStd, ariaLabel: ariaLabelLegacy });
  const resolvedLocale = useLocale(locale);
  const empty = !series.some((s) => s.data.length > 0);
  const definition = useMemo(() => {
    if (empty) return null;
    const all = series.flatMap((s) => s.data);
    let x0 = xDomain?.[0] ?? Math.min(...all.map((p) => p.time));
    let x1 = xDomain?.[1] ?? Math.max(...all.map((p) => p.time));
    // One point (or one instant) still needs a span to draw on.
    if (x0 === x1) {
      x0 -= 1;
      x1 += 1;
    }
    const time = formatTime ?? timeFormatter([x0, x1], resolvedLocale);
    const ticksAt = timeTicks([x0, x1], xTicks);
    const yMax = yDomain?.[1] ?? Math.max(1, ...all.map((p) => p.value)) * 1.08;
    const yMin = yDomain?.[0] ?? 0;
    const marks = [
      ...series.flatMap((s) => {
        const color = chartColors[s.color ?? "requests"];
        const rows: Row[] = s.data.map((p) => ({ ...p, label: s.label }));
        return [
          ...(s.area
            ? [areaY(rows, { x: "time", y: "value", fill: color, fillOpacity: 0.14, id: `${s.id}-area` })]
            : []),
          lineY(rows, {
            x: "time",
            y: "value",
            stroke: color,
            strokeWidth: 2,
            strokeDasharray: s.dashed ? "6 4" : undefined,
            id: s.id,
          }),
        ];
      }),
      ...markers(deploy).flatMap((m, i) => [
        decorative(
          ruleX([{ time: m.time }], {
            x: "time",
            stroke: chartColors.deploy,
            strokeOpacity: 0.8,
            strokeDasharray: "2 4",
            strokeWidth: 1.5,
            id: `deploy-${i}`,
          }),
        ),
        decorative(
          text([{ time: m.time, y: yMax * 0.96, t: m.label }], {
            x: "time",
            y: "y",
            text: "t",
            anchor: "start",
            dx: 8,
            fill: chartColors.deploy,
            fontSize: 11,
            fontWeight: 600,
            id: `deploy-label-${i}`,
          }),
        ),
      ]),
    ];
    return defineChart({
      marks,
      scales: {
        x: {
          scale: scaleLinear().domain([x0, x1]),
          axis: {
            line: false,
            ticks: { ...(ticksAt ? { values: ticksAt } : { count: xTicks }), size: 0, format: time },
          },
        },
        y: {
          scale: scaleLinear().domain([yMin, yMax]),
          axis: { line: false, ticks: { count: yTicks, size: 0, format: formatTick } },
          grid: { stroke: chartColors.grid, strokeOpacity: 1 },
        },
      },
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        // In the top layer, so a tile or card with overflow hidden never clips it.
        portal,
        format: (p: { datum: Row }) => `${time(p.datum.time)}\n${p.datum.label}: ${formatValue(p.datum.value)}`,
      },
    });
  }, [empty, series, deploy, yDomain, xDomain, formatTime, formatValue, formatTick, xTicks, yTicks, resolvedLocale]);

  if (!definition) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel}: ${emptyText}`}
        data-empty=""
        style={{ height }}
        className={cn(
          chartClassName,
          "grid w-full place-items-center rounded-lg bg-well text-sb-sm text-fg-muted shadow-tray",
          className,
        )}
      >
        <span aria-hidden="true">{emptyText}</span>
      </div>
    );
  }

  return (
    <Chart
      definition={definition}
      height={height}
      ariaLabel={ariaLabel}
      className={cn(chartClassName, "w-full text-fg-muted", className)}
    />
  );
}
