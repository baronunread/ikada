import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { softSurface } from "./status";
import type { Status } from "./status";
import { StatusGlyph } from "./status-glyph";

export interface BadgeProps extends ComponentProps<"span"> {
  /** Status that sets the colour and the glyph. Default neutral. */
  tone?: Status;
  /** Adds a leading status shape. The text is always the primary signal. */
  dot?: boolean;
  /** With tone="success" and a dot: the bullseye shape for "Live" (serving traffic) instead of the "Ready" circle. */
  live?: boolean;
  /** With tone="success" and a dot: the dot sprouts on mount, for something just created or just succeeded. */
  sprout?: boolean;
}

/** A short status or label in a soft tinted pill. With `dot`, a status shape leads the text. */
export function Badge({
  tone = "neutral",
  dot = false,
  live = false,
  sprout = false,
  className,
  children,
  ref,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      ref={ref}
      data-tone={tone}
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sb-xs font-semibold",
        dot && "ps-2",
        softSurface[tone],
        className,
      )}
      {...props}
    >
      {dot ? <StatusGlyph tone={tone} live={live} sprout={sprout} /> : null}
      {typeof children === "string" ? (
        <span className="min-w-0 truncate" title={children}>
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  );
}
