"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn, focusRing } from "../lib/cn";

export interface SwitchProps extends Omit<ComponentProps<typeof BaseSwitch.Root>, "className" | "children"> {
  className?: string;
  /** Visible label beside the switch. Without it, pass aria-label. */
  label?: ReactNode;
}

/**
 * An on/off setting that applies at once. The thumb rides the snappy spring and squishes toward
 * its travel while pressed. Checked is a solid green track (3:1 against the off track and surface).
 */
export function Switch({ label, className, id, ref, ...props }: SwitchProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const control = (
    <BaseSwitch.Root
      data-slot="switch"
      ref={ref}
      id={controlId}
      // A <label> does not name a role="switch" span, so name it by reference.
      aria-labelledby={label ? `${controlId}-label` : undefined}
      className={cn(
        "group relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-hover p-[3px]",
        "shadow-[inset_0_0_0_1.5px_var(--sb-control-edge),inset_0_1px_2px_oklch(0_0_0/0.1)]",
        "transition-[background-color,box-shadow] duration-(--sb-duration-hover) ease-hover",
        "hover:shadow-[inset_0_0_0_1.5px_var(--sb-fg-muted),inset_0_1px_2px_oklch(0_0_0/0.1)]",
        "data-checked:bg-brand data-checked:shadow-[inset_0_1px_2px_oklch(0.2_0.06_152/0.3)] data-checked:hover:bg-brand-hover",
        // Pressing squishes the thumb; a disabled switch does not respond.
        "[&:active:not([data-disabled])]:[--sb-squish:1]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        focusRing,
        !label && className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className={cn(
          "block size-[18px] rounded-full bg-fg-muted",
          "shadow-[0_0_0_0.5px_oklch(0_0_0/0.12),0_1px_2px_oklch(0_0_0/0.25),0_2px_4px_-1px_oklch(0_0_0/0.15)]",
          // Squish toward the direction of travel: anchored on the side it leaves from.
          "origin-left data-checked:origin-right rtl:origin-right rtl:data-checked:origin-left",
          "scale-x-[calc(1+0.18*var(--sb-squish,0)*var(--sb-move))] scale-y-[calc(1-0.06*var(--sb-squish,0)*var(--sb-move))]",
          "[transition:translate_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy),scale_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy),background-color_var(--sb-duration-hover)_var(--ease-hover)]",
          "group-active:[transition:translate_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy),scale_var(--sb-duration-press)_var(--ease-out),background-color_var(--sb-duration-hover)_var(--ease-hover)]",
          "data-checked:translate-x-4 data-checked:bg-on-brand rtl:data-checked:-translate-x-4",
        )}
      />
    </BaseSwitch.Root>
  );
  if (!label) return control;
  return (
    <label
      htmlFor={controlId}
      className={cn("inline-flex max-w-full items-center gap-2.5 text-sb-base text-fg", className)}
    >
      {control}
      <span id={`${controlId}-label`} className="min-w-0 [overflow-wrap:anywhere]">
        {label}
      </span>
    </label>
  );
}
