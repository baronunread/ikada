import { areaY, defineChart, dot, lineY } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { chartClassName, chartColors } from "./theme";
import type { ChartColorName } from "./theme";

export interface SparklineProps {
  /** Values in time order, oldest first. */
  data: readonly number[];
  /** Accessible name, e.g. "Requests, last 24 hours". Required. */
  ariaLabel: string;
  /** Chart colour token for the line. Default `requests`. */
  color?: ChartColorName;
  /** Height in pixels. Default 40; the width fills the container. */
  height?: number;
  /** Fill under the line. Defaults to true. */
  area?: boolean;
  /** [min, max]; defaults to 0 up to the largest value so sparklines compare honestly. */
  domain?: readonly [number, number];
  /** Formats the hover value. */
  formatValue?: (value: number) => string;
  /** Label for a hovered point; defaults to its position. */
  formatPoint?: (index: number) => string;
  /** A dot on the newest value, so the eye lands on "now". Defaults to true. */
  current?: boolean;
  className?: string;
}

const defaultValue = (value: number): string => formatNumber(value);
const defaultPoint = (index: number): string => `#${index + 1}`;

interface Row {
  i: number;
  v: number;
}

/** A 40px trend line with no axes, a dot on the current point, a hover value and the same tokens as TimeseriesChart. */
export function Sparkline({
  data,
  ariaLabel,
  color = "requests",
  height = 40,
  area = true,
  domain,
  formatValue = defaultValue,
  formatPoint = defaultPoint,
  current = true,
  className,
}: SparklineProps) {
  const definition = useMemo(() => {
    const rows: Row[] = data.map((v, i) => ({ i, v }));
    const last = rows.at(-1);
    const stroke = chartColors[color];
    const max = domain?.[1] ?? Math.max(1, ...data) * 1.05;
    return defineChart({
      marks: [
        ...(area ? [areaY(rows, { x: "i", y: "v", fill: stroke, fillOpacity: 0.14, id: "area" })] : []),
        lineY(rows, { x: "i", y: "v", stroke, strokeWidth: 1.75, id: "line" }),
        ...(current && last
          ? [
              decorative(
                dot([last], {
                  x: "i",
                  y: "v",
                  r: 3,
                  fill: stroke,
                  stroke: "var(--sb-surface)",
                  strokeWidth: 1.5,
                  id: "now",
                }),
              ),
            ]
          : []),
      ],
      scales: {
        x: { scale: scaleLinear().domain([0, Math.max(1, data.length - 1)]), axis: false },
        y: { scale: scaleLinear().domain([domain?.[0] ?? 0, max]), axis: false },
      },
      guides: false,
      margin: { top: 4, right: 6, bottom: 2, left: 6 },
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        format: (p: { datum: Row }) => `${formatPoint(p.datum.i)}\n${formatValue(p.datum.v)}`,
      },
    });
  }, [data, color, area, domain, formatValue, formatPoint, current]);

  return (
    <Chart
      definition={definition}
      height={height}
      ariaLabel={ariaLabel}
      className={cn(chartClassName, "w-full", className)}
    />
  );
}
