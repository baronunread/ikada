"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn, coarseTarget, focusRing, pebble, traySurface } from "../lib/cn";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Plain text name when `label` is only an icon. */
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
      className={cn("group/seg relative inline-flex w-full gap-0.5 p-0.5", traySurface, className)}
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
          aria-label={option.ariaLabel}
          className={cn(
            "relative z-10 inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold text-fg-muted",
            "transition-[background-color,color,box-shadow] duration-(--sb-duration-hover) ease-hover hover:text-fg",
            "data-pressed:bg-raised data-pressed:text-fg data-pressed:shadow-pill",
            "group-data-pebble/seg:data-pressed:bg-transparent group-data-pebble/seg:data-pressed:shadow-none",
            "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            size === "sm" ? "h-6 px-2 text-sb-xs" : "h-7 px-3 text-sb-sm",
            coarseTarget,
            focusRing,
          )}
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
