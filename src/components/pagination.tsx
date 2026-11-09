"use client";

import type { ComponentProps } from "react";
import { cn, coarseTarget, focusRing, pressMotion } from "../lib/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "../lib/icons";

export interface PaginationProps extends Omit<ComponentProps<"nav">, "onChange"> {
  /** Current page, starting at 1. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Called with the page to go to. */
  onPageChange: (page: number) => void;
  /** Previous and next plus "Page 3 of 12", no number buttons. Use it on narrow screens. */
  compact?: boolean;
  /** Pages shown either side of the current one. Default 1. */
  siblings?: number;
}

/** A run of hidden pages: before the current window or after it. */
export type PageGap = "gap-start" | "gap-end";

/**
 * The page numbers to show. Past a short list it is always 2 * siblings + 5 slots (first, last, two
 * gaps or pages, and the window), so the control keeps its width while you page, and a gap never
 * hides a single page: it would take the same room as the number it replaces.
 */
export function pageRange(page: number, pageCount: number, siblings = 1): (number | PageGap)[] {
  const s = Math.max(0, Math.floor(siblings));
  const slots = 2 * s + 5;
  const all = (from: number, to: number): number[] =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  if (pageCount <= slots) return all(1, pageCount);
  const current = Math.min(Math.max(1, page), pageCount);
  if (current - s <= 3) return [...all(1, 2 * s + 3), "gap-end", pageCount];
  if (current + s >= pageCount - 2) return [1, "gap-start", ...all(pageCount - (2 * s + 2), pageCount)];
  return [1, "gap-start", ...all(current - s, current + s), "gap-end", pageCount];
}

const cell = cn(
  "inline-grid h-8 min-w-8 place-items-center rounded-md px-2 text-sb-sm font-semibold tabular-nums text-fg-muted",
  "hover:bg-hover hover:text-fg",
  pressMotion,
  "disabled:pointer-events-none disabled:opacity-50",
  coarseTarget,
  focusRing,
);

/** Previous, next and numbered pages for a long list, with gaps past the neighbours of the current page. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  compact = false,
  siblings = 1,
  className,
  ref,
  ...props
}: PaginationProps) {
  const go = (next: number) => onPageChange(Math.min(Math.max(1, next), Math.max(1, pageCount)));
  return (
    <nav
      data-slot="pagination"
      ref={ref}
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        className={cell}
      >
        <ChevronLeftIcon className="rtl:-scale-x-100" />
      </button>
      {compact ? (
        <span className="min-w-0 px-2 text-sb-sm text-fg-muted tabular-nums" aria-live="polite">
          Page {page} of {pageCount}
        </span>
      ) : (
        <ul className="flex flex-wrap items-center gap-1">
          {pageRange(page, pageCount, siblings).map((entry) => (
            <li key={entry}>
              {entry === "gap-start" || entry === "gap-end" ? (
                <span aria-hidden="true" className="inline-grid h-8 min-w-6 place-items-center text-fg-muted">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? "page" : undefined}
                  onClick={() => go(entry)}
                  className={cn(
                    cell,
                    "aria-[current=page]:bg-hover aria-[current=page]:text-fg aria-[current=page]:shadow-pill",
                  )}
                >
                  {entry}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
        className={cell}
      >
        <ChevronRightIcon className="rtl:-scale-x-100" />
      </button>
    </nav>
  );
}
