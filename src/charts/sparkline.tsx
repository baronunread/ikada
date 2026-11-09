"use client";

import { areaY, defineChart, dot, lineY } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { accessibleName } from "../lib/accessible-name";
import type { AccessibleName } from "../lib/accessible-name";
import { chartClassName, chartColors } from "./theme";
import type { ChartColorName } from "./theme";

export interface SparklineBase {
  /** Values in time order, oldest first. */
  data: readonly number[];
  /** Chart colour token for the line. Default `requests`. */
  color?: ChartColorName;
  /** Height in pixels. Default 44; the width fills the container. */
  height?: number;
  /** Fill under the line. Defaults to true. */
  area?: boolean;
  /** [min, max]. Defaults to the data's own range with a little air above and below, so a quiet series still shows its shape; pass [0, max] to compare several on one honest scale. */
  domain?: readonly [number, number];
  /** What the number is, shown once next to the value in the hover tooltip ("Requests  10,303"), so `formatValue` should not repeat it. Defaults to the first words of `ariaLabel` ("Requests" from "Requests, last 24 hours"). */
  label?: string;
  /** Formats the hover value. */
  formatValue?: (value: number) => string;
  /** Label for a hovered point; defaults to its position. */
  formatPoint?: (index: number) => string;
  /** A dot on the newest value, so the eye lands on "now". Defaults to true. */
  current?: boolean;
  className?: string;
}

const defaultValue = (value: number): string => formatNumber(value);
const defaultPoint = (index: number): string => `Point ${index + 1}`;

interface Row {
  i: number;
  v: number;
}

/** Props of {@link Sparkline}. The accessible name is `aria-label` (e.g. "Requests, last 24 hours"); `ariaLabel` is deprecated. */
export type SparklineProps = SparklineBase & AccessibleName;

/** A 44px trend line with no axes, a dot on the current point, a hover value and the same tokens as TimeseriesChart. */
export function Sparkline({
  data,
  "aria-label": ariaLabelStd,
  ariaLabel: ariaLabelLegacy,
  color = "requests",
  height = 44,
  area = true,
  domain,
  label,
  formatValue = defaultValue,
  formatPoint = defaultPoint,
  current = true,
  className,
}: SparklineProps) {
  const ariaLabel = accessibleName({ "aria-label": ariaLabelStd, ariaLabel: ariaLabelLegacy });
  const definition = useMemo(() => {
    const rows: Row[] = data.map((v, i) => ({ i, v }));
    const last = rows.at(-1);
    const stroke = chartColors[color];
    const name = label ?? ariaLabel.split(",")[0]!.trim();
    const lo = data.length ? Math.min(...data) : 0;
    const hi = data.length ? Math.max(...data) : 1;
    // Fit the data with air: 22% of the range below (the fill needs a floor) and 14% above (room for the stroke and the dot).
    const span = hi - lo || Math.max(Math.abs(hi), 1) * 0.2;
    const yMin = domain?.[0] ?? lo - span * 0.22;
    const yMax = domain?.[1] ?? hi + span * 0.14;
    return defineChart({
      marks: [
        ...(area ? [areaY(rows, { x: "i", y: "v", fill: stroke, fillOpacity: 0.1, id: "area" })] : []),
        lineY(rows, { x: "i", y: "v", stroke, strokeWidth: 1.75, id: "line" }),
        crosshair({
          x: { stroke, strokeOpacity: 0.4, strokeWidth: 1, strokeDasharray: "2 3" },
          y: false,
          marker: { radius: 4, fill: "var(--sb-surface)", stroke, strokeWidth: 2 },
        }),
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
        y: { scale: scaleLinear().domain([yMin, yMax]), axis: false },
      },
      guides: false,
      // Flush left so the fill starts at the tile edge; room on the right for the dot; the bottom is the tile edge.
      margin: { top: 6, right: 8, bottom: 0, left: 0 },
      focus: "nearest-x",
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        // A floating card in the top layer: never clipped by the tile, flips above or below the point.
        portal,
        // below first: above the point is where a tile keeps its figure and its change badge
        placement: ["bottom", "top"],
        offset: 12,
        content: (points: readonly { datum: unknown }[]) => {
          const d = points[0]!.datum as Row;
          return {
            title: formatPoint(d.i),
            rows: [{ label: name, value: formatValue(d.v), color: stroke, active: true }],
          };
        },
      },
    });
  }, [data, color, area, domain, label, ariaLabel, formatValue, formatPoint, current]);

  return (
    <Chart
      definition={definition}
      height={height}
      ariaLabel={ariaLabel}
      className={cn(chartClassName, "w-full", className)}
    />
  );
}
