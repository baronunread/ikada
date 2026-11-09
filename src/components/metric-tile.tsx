"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatCompact } from "../lib/format";
import { useLocale } from "../lib/locale";
import { ArrowDownIcon, ArrowUpIcon } from "../lib/icons";
import { Skeleton } from "./skeleton";

export interface MetricDelta {
  /** "12%" or "0.3 pt". */
  value: string;
  direction: "up" | "down";
  /** Whether that direction is good news. Default neutral: a rise in requests is not good or bad. */
  sentiment?: "good" | "bad" | "neutral";
}

export interface MetricTileProps extends Omit<ComponentProps<"div">, "children"> {
  /** What the number measures, above it. */
  label: string;
  /** Already formatted: "0.21". For a plain count prefer `amount`. */
  value?: string;
  /** A count, formatted compactly in `locale` ("1.28M", "860K"). Wins over `value`. */
  amount?: number;
  /** Number-formatting locale; defaults to the `LocaleProvider` value, else `en`. */
  locale?: string;
  /** "M", "%", "ms p50". */
  unit?: string;
  /** Change against the previous period, shown as an arrow and a value. */
  delta?: MetricDelta;
  /** A line under the value: "14.8 req/s average". */
  hint?: ReactNode;
  /** A `<Sparkline />` from `@sproutboat/ikada/charts`, flush to the tile's bottom edge. */
  sparkline?: ReactNode;
  /** Draws a skeleton in place of the value. */
  loading?: boolean;
  /** Nothing to show for this range: an em dash and `emptyText`. */
  noData?: boolean;
  /** Shown when there is no value. Default "No data for this range". */
  emptyText?: string;
}

const sentimentClass = {
  good: "bg-brand-soft text-brand-fg",
  bad: "bg-danger-soft text-danger-fg",
  neutral: "bg-neutral-soft text-neutral-fg",
} as const;

/**
 * One headline number with its unit, change and trend. The hero figure is proportional at 28px
 * (tabular figures belong in columns); the delta is a soft pill; the sparkline marks the current point.
 */
export function MetricTile({
  label,
  value,
  amount,
  unit,
  delta,
  hint,
  sparkline,
  loading = false,
  noData = false,
  emptyText = "No data for this range",
  locale,
  className,
  ref,
  ...props
}: MetricTileProps) {
  const resolved = useLocale(locale);
  const shown = amount === undefined ? value : formatCompact(amount, { locale: resolved });
  const Arrow = delta?.direction === "up" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div
      data-slot="metric-tile"
      ref={ref}
      role="group"
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface shadow-card", className)}
      {...props}
    >
      <div className="flex flex-col gap-1 px-4 pt-3.5">
        <span className="text-sb-sm font-medium text-fg-muted">{label}</span>
        {loading ? (
          <div className="flex flex-col gap-2 py-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="w-32" />
            <span className="sr-only">Loading</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={cn("text-sb-metric proportional-nums", noData && "text-fg-muted")}>
                {noData ? "—" : shown}
              </span>
              {unit && !noData ? <span className="text-sb-base font-medium text-fg-muted">{unit}</span> : null}
              {delta && !noData ? (
                <span
                  className={cn(
                    "ms-1 inline-flex h-5 items-center gap-0.5 self-center rounded-full px-1.5 text-sb-xs font-semibold tabular-nums",
                    sentimentClass[delta.sentiment ?? "neutral"],
                  )}
                >
                  <Arrow className="size-3.5" />
                  <span className="sr-only">{delta.direction === "up" ? "Up" : "Down"} </span>
                  {delta.value}
                </span>
              ) : null}
            </div>
            <span className="min-h-5 text-sb-sm text-fg-muted">{noData ? emptyText : hint}</span>
          </>
        )}
      </div>
      <div className="mt-2 h-10">{loading || noData ? null : sparkline}</div>
    </div>
  );
}
