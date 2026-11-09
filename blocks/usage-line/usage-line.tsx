/**
 * Today's quotas in one quiet row, each a figure and a small meter that turns amber
 * near its limit, with the plan and reset time at the end. The whole row links to a usage page.
 */
import { Meter, usageState } from "../../src/components/meter";
import type { MeterTone } from "../../src/components/meter";
import { Skeleton } from "../../src/components/skeleton";
import { cn, focusRing } from "../../src/lib/cn";
import { formatBytes, formatCompact } from "../../src/lib/format";
import { ChevronRightIcon, GaugeIcon } from "../../src/lib/icons";

export interface UsageQuota {
  id: string;
  label: string;
  used: number;
  limit: number;
  /** How the figure reads: a count ("1.2M / 3M"), bytes ("640 MB / 1 GB") or a share of the limit ("68%"). */
  unit: "count" | "bytes" | "percent";
}

export interface UsageLineProps {
  quotas?: UsageQuota[];
  /** Shown at the end of the row, such as the plan and when the quotas reset. */
  note?: string;
  /** Where the row links to. */
  href?: string;
  /** Draws placeholders while usage loads. */
  loading?: boolean;
  className?: string;
}

/** Sample data: a Free plan account two thirds through its day, storage nearly full. */
export const sampleQuotas: UsageQuota[] = [
  { id: "requests", label: "Requests", used: 61_400, limit: 100_000, unit: "count" },
  { id: "cpu", label: "CPU time", used: 0.42, limit: 1, unit: "percent" },
  { id: "storage", label: "Storage", used: 912_000_000, limit: 1_000_000_000, unit: "bytes" },
];

function figure(q: UsageQuota): string {
  if (q.unit === "percent") return `${Math.round((q.used / q.limit) * 100)}%`;
  if (q.unit === "bytes") return `${formatBytes(q.used)} / ${formatBytes(q.limit)}`;
  return `${formatCompact(q.used)} / ${formatCompact(q.limit)}`;
}

function tone(q: UsageQuota): MeterTone {
  const state = usageState(q.used, q.limit);
  return state === "near" || state === "at" ? "warning" : "normal";
}

function Quota({ quota }: { quota: UsageQuota }) {
  const value = figure(quota);
  const t = tone(quota);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-fg-muted">{quota.label}</span>
      <span className={cn("font-semibold tabular-nums", t === "warning" && "text-warn-fg")}>{value}</span>
      <Meter
        aria-label={`${quota.label}: ${value}`}
        value={Math.min(quota.used, quota.limit)}
        max={quota.limit}
        tone={t}
        valueLabel={null}
        className="w-14"
      />
    </span>
  );
}

export function UsageLine({
  quotas = sampleQuotas,
  note = "Free plan · resets 00:00 UTC",
  href = "#usage",
  loading = false,
  className,
}: UsageLineProps) {
  return (
    <a
      href={href}
      className={cn(
        "group @container block rounded-xl bg-surface px-4 py-3 text-sb-sm text-fg shadow-card",
        "transition-shadow duration-(--sb-duration-hover) ease-hover hover:shadow-float",
        focusRing,
        className,
      )}
    >
      {/* Container queries, not breakpoints: the row wraps to fit wherever it is placed. */}
      <span className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
        <span className="inline-flex items-center gap-2 font-semibold">
          <GaugeIcon className="text-fg-muted" />
          Today
        </span>
        {loading ? <Skeleton className="h-4 w-[min(28rem,60%)]" /> : quotas.map((q) => <Quota key={q.id} quota={q} />)}
        <span className="inline-flex items-center gap-1 text-fg-muted @max-3xl:basis-full @3xl:ms-auto">
          {note}
          <ChevronRightIcon className="transition-transform duration-(--sb-duration-hover) group-hover:translate-x-0.5" />
          <span className="sr-only">. Open the usage page</span>
        </span>
      </span>
    </a>
  );
}
