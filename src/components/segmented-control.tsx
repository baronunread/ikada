"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { cn, coarseTarget, focusRing, pebble, traySurface } from "../lib/cn";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Plain text name when `label` is only an icon. */
  "aria-label"?: string;
  /** @deprecated Use `aria-label`; removed in 0.3.0. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  /** The segments, in order: value and label. */
  options: readonly SegmentedOption<T>[];
  /** The chosen segment's value (controlled). */
  value: T;
  /** Called with the newly chosen value. */
  onValueChange: (value: T) => void;
  /** Names the group, e.g. "Theme". Required. */
  "aria-label": string;
  /** Control height: sm or md (the default). */
  size?: "sm" | "md";
  className?: string;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measures the pressed segment so one pebble can slide to it. Until it has a size (server render,
 * first paint, a hidden parent) the pressed segment paints its own raised background instead.
 */
function usePebble(value: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const group = ref.current;
    if (!group) return undefined;
    const measure = () => {
      const el = group.querySelector<HTMLElement>("[data-pressed]");
      if (!el || el.offsetWidth === 0) {
        setBox(null);
        return;
      }
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      setBox((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [value]);
  // The first placement is instant; only later moves slide.
  useEffect(() => {
    if (!box || ready) return undefined;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [box, ready]);
  return { ref, box, ready };
}

const FADE = 20;

/**
 * When the tray scrolls (more options than room), fades the edge that has more content behind it, so a
 * clipped label reads as "scrolls" rather than "cut off". Keeps the chosen option in view on mount and change.
 */
function useScrollEdges(ref: RefObject<HTMLDivElement | null>, value: string): CSSProperties | undefined {
  const [edges, setEdges] = useState({ start: false, end: false });
  useIsomorphicLayoutEffect(() => {
    const group = ref.current;
    if (!group) return undefined;
    const update = () => {
      const max = group.scrollWidth - group.clientWidth;
      // scrollLeft is 0 at the start edge in both directions; it runs negative in RTL.
      const at = Math.abs(group.scrollLeft);
      const next = { start: max > 1 && at > 1, end: max > 1 && at < max - 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    group.addEventListener("scroll", update, { passive: true });
    if (typeof ResizeObserver === "undefined") return () => group.removeEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(group);
    return () => {
      group.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref]);
  useIsomorphicLayoutEffect(() => {
    const group = ref.current;
    const el = group?.querySelector<HTMLElement>("[data-pressed]");
    if (!group || !el) return;
    // Scroll the tray only (scrollIntoView could move the page), the least that shows the whole option.
    const g = group.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < g.left) group.scrollLeft -= g.left - r.left + 4;
    else if (r.right > g.right) group.scrollLeft += r.right - g.right + 4;
  }, [ref, value]);
  if (!edges.start && !edges.end) return undefined;
  const physicalLeft = getComputedStyleDirection(ref.current) === "rtl" ? edges.end : edges.start;
  const physicalRight = getComputedStyleDirection(ref.current) === "rtl" ? edges.start : edges.end;
  const mask = `linear-gradient(to right, ${physicalLeft ? "transparent" : "#000"} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${physicalRight ? "transparent" : "#000"} 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

function getComputedStyleDirection(el: HTMLElement | null): "ltr" | "rtl" {
  return el && typeof getComputedStyle !== "undefined" && getComputedStyle(el).direction === "rtl" ? "rtl" : "ltr";
}

/**
 * One choice out of a few, always one selected (a click on the selected segment does nothing).
 * Arrow keys move between segments; Space or Enter selects. A raised pebble on a recessed tray
 * marks the choice and slides to the new segment on the snappy spring.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const { ref, box, ready } = usePebble(value);
  const fade = useScrollEdges(ref, value);
  return (
    <ToggleGroup
      data-slot="segmented-control"
      ref={ref}
      aria-label={ariaLabel}
      value={[value]}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next[0]);
        if (chosen) onValueChange(chosen.value);
      }}
      data-pebble={box ? "" : undefined}
      style={fade}
      className={cn(
        "group/seg relative inline-flex w-full max-w-full gap-0.5 overflow-x-auto p-0.5 [scrollbar-width:none]",
        traySurface,
        className,
      )}
    >
      {box ? (
        <span
          aria-hidden="true"
          data-sb-pebble=""
          className={cn(pebble, !ready && "transition-none")}
          style={
            {
              width: box.w,
              height: box.h,
              translate: `${box.x}px ${box.y}px`,
            } satisfies CSSProperties
          }
        />
      ) : null}
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option["aria-label"] ?? option.ariaLabel}
          className={cn(
            "relative z-10 inline-flex min-w-max flex-1 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md font-semibold text-fg-muted",
            "transition-[background-color,color,box-shadow] duration-(--sb-duration-hover) ease-hover hover:text-fg",
            "data-pressed:bg-raised data-pressed:text-fg data-pressed:shadow-pill",
            "group-data-pebble/seg:data-pressed:bg-transparent group-data-pebble/seg:data-pressed:shadow-none",
            "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            size === "sm" ? "h-6 px-2 text-sb-xs" : "h-7 px-3 text-sb-sm",
            coarseTarget,
            focusRing,
          )}
        >
          {typeof option.label === "string" ? (
            <span className="max-w-64 min-w-0 truncate" title={option.label}>
              {option.label}
            </span>
          ) : (
            option.label
          )}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
