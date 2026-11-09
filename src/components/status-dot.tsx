import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import type { Status } from "./status";
import { StatusGlyph } from "./status-glyph";

export interface StatusDotProps extends Omit<ComponentProps<"span">, "children"> {
  /** Which status: sets the shape and the colour. */
  status: Status;
  /** Required: a dot is never the only signal. */
  label: string;
  /** Keeps the label for screen readers and hides it visually (dense tables). */
  hideLabel?: boolean;
  /** Success that is serving traffic ("Live 90%"): its own bullseye shape, not the "Ready" circle. */
  live?: boolean;
  /** Pulses for in-progress states; the ring stops spinning when motion is reduced. */
  pulse?: boolean;
  /** Success that just happened: the shape sprouts on mount (grows up and sends one ring out). */
  sprout?: boolean;
}

/** A status shape with its label, for lists and headers. Never colour alone. */
export function StatusDot({
  status,
  label,
  hideLabel = false,
  live = false,
  pulse = false,
  sprout = false,
  className,
  ref,
  ...props
}: StatusDotProps) {
  return (
    <span
      ref={ref}
      data-status={status}
      className={cn("inline-flex items-center gap-2 text-sb-base text-fg", className)}
      {...props}
    >
      <StatusGlyph status={status} live={live} pulse={pulse} sprout={sprout} />
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
