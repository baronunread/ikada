"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { coarseTarget, focusRing, pressMotion, tv } from "../lib/cn";
import type { VariantProps } from "../lib/cn";
import { SpinnerIcon } from "../lib/icons";

export const buttonStyles = tv({
  base: [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold",
    pressMotion,
    // Optical alignment: the icon side gets 2px less padding than the text side.
    "has-[>svg:first-child:not(:only-child)]:ps-3 has-[>svg:last-child:not(:only-child)]:pe-3",
    "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:active:translate-y-0 data-disabled:active:scale-100",
    "data-loading:cursor-progress",
    focusRing,
    coarseTarget,
  ],
  variants: {
    variant: {
      // Hover is colour plus a lift in the cast shadow; a press presses the shadow in.
      primary:
        "bg-brand text-on-brand shadow-primary hover:bg-brand-hover hover:shadow-primary-hover active:bg-brand-hover active:shadow-primary-pressed data-disabled:shadow-primary",
      secondary:
        "bg-hover text-fg shadow-button hover:bg-[color-mix(in_oklch,var(--sb-hover),var(--sb-fg)_9%)] hover:shadow-button-hover active:shadow-button-pressed data-disabled:shadow-button",
      ghost: "bg-transparent text-fg-muted hover:bg-hover hover:text-fg",
      danger: [
        "bg-danger text-on-danger hover:bg-danger-hover",
        "shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_1px_2px_oklch(0.3_0.1_25/0.3),0_6px_14px_-6px_oklch(0.35_0.12_25/0.4)]",
        "hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.24),0_2px_4px_oklch(0.3_0.1_25/0.3),0_10px_20px_-6px_oklch(0.35_0.12_25/0.5)]",
        "active:bg-danger-hover active:shadow-[inset_0_2px_3px_oklch(0.2_0.08_25/0.35)]",
      ],
    },
    size: {
      sm: "h-(--sb-control-h-sm) px-2.5 text-sb-sm",
      md: "h-(--sb-control-h) px-3.5 text-sb-base",
      lg: "h-11 px-4.5 text-sb-base",
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

export type ButtonVariants = VariantProps<typeof buttonStyles>;

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, "className">, ButtonVariants {
  className?: string;
  /** Shows a spinner, sets aria-busy, ignores clicks, keeps the width and focus. */
  loading?: boolean;
}

/**
 * The action control: primary (green, one per view), secondary, ghost and danger, in three sizes.
 * A press settles it 1px down and 3% smaller; the release bobs back once. `loading` keeps the width.
 */
export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  onClick,
  ref,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      ref={ref}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      data-loading={loading ? "" : undefined}
      onClick={loading ? undefined : onClick}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
          <SpinnerIcon className="absolute" />
        </>
      ) : (
        children
      )}
    </BaseButton>
  );
}
