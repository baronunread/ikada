import type { ChartTooltipContent, ChartTooltipRow } from "@tanstack/charts/tooltip";

/** The hover card both Sparkline and TimeseriesChart show: an optional title (usually the time) over one swatch row per series. */
export function tooltipCard(title: string | undefined, rows: readonly ChartTooltipRow[]): ChartTooltipContent {
  return { ...(title ? { title } : {}), rows };
}
