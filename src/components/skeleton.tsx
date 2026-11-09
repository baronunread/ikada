import type { ComponentProps } from "react";
import { tv } from "../lib/cn";
import type { VariantProps } from "../lib/cn";

const skeletonStyles = tv({
  // A slow breath, not a sweep; siblings start 120ms apart so a block of lines swells top to bottom.
  base: [
    "block bg-hover animate-[sb-breathe_1.6s_ease-in-out_infinite]",
    "[&:nth-child(2)]:[animation-delay:120ms] [&:nth-child(3)]:[animation-delay:240ms] [&:nth-child(4)]:[animation-delay:360ms] [&:nth-child(n+5)]:[animation-delay:480ms]",
  ],
  variants: {
    kind: {
      line: "h-3.5 w-full rounded-sm",
      block: "h-20 w-full rounded-lg",
      circle: "size-8 rounded-full",
    },
  },
  defaultVariants: { kind: "line" },
});

export interface SkeletonProps extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof skeletonStyles> {}

/** Decorative placeholder (a fade, so it stays under reduced motion). Give the loading region `aria-busy`. */
export function Skeleton({ kind, className, ref, ...props }: SkeletonProps) {
  return (
    <span
      data-slot="skeleton"
      ref={ref}
      aria-hidden="true"
      className={skeletonStyles({ kind, className })}
      {...props}
    />
  );
}
