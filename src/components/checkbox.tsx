"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn, focusRing } from "../lib/cn";
import { CheckIcon, MinusIcon } from "../lib/icons";

export interface CheckboxProps extends Omit<ComponentProps<typeof BaseCheckbox.Root>, "className" | "children"> {
  className?: string;
  /** Visible label. Without one, pass aria-label. */
  label?: ReactNode;
  /** Muted line under the label, linked to the checkbox as its description. */
  description?: ReactNode;
  /** Marks the checkbox invalid: danger ring and aria-invalid. */
  invalid?: boolean;
}

/**
 * A yes/no choice in a form. The box bobs once as it fills (only on a change, never on mount) and
 * the checked fill is solid green, 3:1 against the unchecked box and the surface in both themes.
 */
export function Checkbox({
  label,
  description,
  invalid,
  className,
  id,
  ref,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const [bob, setBob] = useState(false);
  const box = (
    <BaseCheckbox.Root
      data-slot="checkbox"
      ref={ref}
      id={controlId}
      // A <label> does not name a role="checkbox" span, so name it by reference.
      aria-labelledby={label ? `${controlId}-label` : undefined}
      aria-describedby={label && description ? `${controlId}-description` : undefined}
      aria-invalid={invalid || undefined}
      data-sb-bob={bob ? "" : undefined}
      onCheckedChange={(checked, details) => {
        if (checked) setBob(true);
        onCheckedChange?.(checked, details);
      }}
      onAnimationEnd={(event) => {
        if (event.animationName === "sb-bob") setBob(false);
      }}
      className={cn(
        "mt-px inline-flex size-4.5 shrink-0 items-center justify-center rounded-xs bg-well text-on-brand",
        "data-sb-bob:animate-[sb-bob_var(--sb-duration-spring-bob)_var(--sb-spring-bob)]",
        "shadow-[inset_0_0_0_1.5px_var(--sb-control-edge)]",
        "transition-[background-color,box-shadow] duration-(--sb-duration-hover) ease-hover",
        "hover:shadow-[inset_0_0_0_1.5px_var(--sb-fg-muted)]",
        "data-checked:bg-brand data-checked:shadow-none data-indeterminate:bg-brand data-indeterminate:shadow-none",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "aria-invalid:shadow-[inset_0_0_0_1.5px_var(--sb-danger-dot)]",
        "relative before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden",
        focusRing,
        // Keyboard toggling runs the bob and the focus wake together.
        "data-sb-bob:focus-visible:[animation:sb-bob_var(--sb-duration-spring-bob)_var(--sb-spring-bob),sb-wake_var(--sb-duration-wake)_var(--ease-out)]",
        !label && className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        className={cn(
          "flex [transition:opacity_var(--sb-duration-hover)_var(--ease-out),scale_var(--sb-duration-spring-bob)_var(--sb-spring-bob)]",
          "data-ending-style:[transition:opacity_var(--sb-duration-hover)_var(--ease-out),scale_var(--sb-duration-hover)_var(--ease-out)]",
          "data-starting-style:scale-(--sb-scale-icon) data-starting-style:opacity-0",
          "data-ending-style:scale-(--sb-scale-icon) data-ending-style:opacity-0",
        )}
        keepMounted={false}
      >
        <IndicatorIcon indeterminate={props.indeterminate} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
  if (!label) return box;
  return (
    <label
      htmlFor={controlId}
      className={cn("inline-flex max-w-full items-start gap-2.5 text-sb-base text-fg", className)}
    >
      {box}
      <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
        <span id={`${controlId}-label`}>{label}</span>
        {description ? (
          <span id={`${controlId}-description`} className="text-sb-sm text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function IndicatorIcon({ indeterminate }: { indeterminate?: boolean }) {
  return indeterminate ? <MinusIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />;
}
