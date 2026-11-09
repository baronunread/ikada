"use client";

import { areaY, defineChart, dot, lineY } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { useId, useMemo } from "react";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { accessibleName } from "../lib/accessible-name";
import type { AccessibleName } from "../lib/accessible-name";
import { tooltipCard } from "./tooltip-card";
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
  /** Title for a hovered point, usually its time ("14:00"). Without it the card shows just the row ("Requests  11"): a position like "Point 3" says nothing. */
  formatPoint?: (index: number) => string;
  /** A dot on the newest value, so the eye lands on "now". Defaults to true. */
  current?: boolean;
  className?: string;
}

/** Room kept around a point for the hover ring (radius 4 plus half its 2px stroke = 5px, plus 1px): above the lowest value, and at the sides, so the first and last points sit `SIDE` px inside the Sparkline's box. A MetricTile pads its slot by (16 - SIDE) px, so the line's ends line up with the tile's text. */
const FLOOR = 7;
const SIDE = 6;
const MARGIN = { top: 6, right: SIDE, bottom: 0, left: SIDE } as const;

const defaultValue = (value: number): string => formatNumber(value);

interface Row {
  i: number;
  v: number;
}

/** Props of {@link Sparkline}. The accessible name is `aria-label` (e.g. "Requests, last 24 hours"); `ariaLabel` is deprecated. */
export type SparklineProps = SparklineBase & AccessibleName;

/** A 44px trend line with no axes, a dot on the current point, a hover value and the same tokens as TimeseriesChart. */
export function Sparkline({
  data: rawData,
  "aria-label": ariaLabelStd,
  ariaLabel: ariaLabelLegacy,
  color = "requests",
  height = 44,
  area = true,
  domain,
  label,
  formatValue = defaultValue,
  formatPoint,
  current = true,
  className,
}: SparklineProps) {
  const gradientId = `sb-spark-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const ariaLabel = accessibleName({ "aria-label": ariaLabelStd, ariaLabel: ariaLabelLegacy });
  // A NaN or Infinity (a failed division upstream) would make the scale throw and take the page with it: drop it.
  const data = useMemo(() => rawData.filter(Number.isFinite), [rawData]);
  const definition = useMemo(() => {
    const rows: Row[] = data.map((v, i) => ({ i, v }));
    const last = rows.at(-1);
    const stroke = chartColors[color];
    const name = label ?? ariaLabel.split(",")[0]!.trim();
    const lo = data.length ? Math.min(...data) : 0;
    const hi = data.length ? Math.max(...data) : 1;
    // Fit the data with air: 14% of the range above (room for the stroke and the dot). Below, the lowest value sits FLOOR px above the tile edge (see below), whatever the height.
    const span = hi - lo || Math.max(Math.abs(hi), 1) * 0.2;
    let yMin = domain?.[0] ?? lo;
    const yMax = domain?.[1] ?? hi + span * 0.14;
    // The hover ring on the lowest value would be cut by the tile's bottom edge and rounded corners. Lower the scale floor so that value sits FLOOR px up; the fill (y1 = the floor) still runs to the edge. Done in pixels, so it holds at 28px as at 64px, and for an explicit domain too.
    const plotHeight = Math.max(1, height - MARGIN.top);
    if (yMax > yMin) yMin = yMax - (yMax - yMin) / (1 - Math.min(FLOOR / plotHeight, 0.5));
    return defineChart({
      marks: [
        ...(area
          ? [areaY(rows, { x: "i", y: "v", y1: yMin, fill: `url(#${gradientId})`, fillOpacity: 1, id: "area" })]
          : []),
        lineY(rows, { x: "i", y: "v", stroke, strokeWidth: 1.75, id: "line" }),
        // No crosshair: its marker is clipped to the plot rectangle (cutting the ring on the first and last point) and its rule draws through the ring. At 28–64px the focus ring alone marks the point.
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
      // The fill fades out toward the bottom, so it has no hard edge at the foot; at the line ends it stops where the line does. Dropped in forced-colors mode (see theme.css).
      gradients: [
        {
          id: gradientId,
          x1: 0,
          y1: 1,
          x2: 0,
          y2: 0,
          stops: [
            { offset: 0, color: stroke, opacity: 0 },
            { offset: 1, color: stroke, opacity: 0.14 },
          ],
        },
      ],
      // Room for the hover ring at the top and sides; the bottom is the tile edge (the floor is handled in the scale).
      margin: MARGIN,
      focus: "nearest-x",
      // Drawn after every mark, so it sits over the "now" dot instead of beside it; the fill is opaque and wider than the dot.
      focusRing: { radius: 4, fill: "var(--sb-surface)", stroke, strokeWidth: 2 },
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        // A floating card in the top layer: never clipped by the tile, flips above or below the point.
        portal,
        // Anchored to the hovered point's x and the chart's bottom edge: the card hangs just below the sparkline
        // (below a MetricTile, never over its label, figure or badge) and only flips above when there is no room.
        anchor: (points: readonly { x: number }[], context: { surface: { height: number } }) => ({
          x: points[0]!.x,
          y: context.surface.height,
        }),
        placement: ["bottom", "top"],
        offset: 8,
        content: (points: readonly { datum: unknown }[]) => {
          const d = points[0]!.datum as Row;
          return tooltipCard(formatPoint?.(d.i), [
            { label: name, value: formatValue(d.v), color: stroke, active: true },
          ]);
        },
      },
    });
  }, [data, color, area, domain, gradientId, label, ariaLabel, formatValue, formatPoint, current]);

  return (
    <Chart
      definition={definition}
      height={height}
      ariaLabel={ariaLabel}
      className={cn(chartClassName, "w-full", className)}
    />
  );
}
