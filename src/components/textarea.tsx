import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";
import { cn, fieldSurface, focusRing } from "../lib/cn";

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "className"> {
  className?: string;
  /** Marks the field invalid: danger ring and aria-invalid. Prefer the Field error. */
  invalid?: boolean;
  /** Monospace face for code, SQL and JSON. */
  mono?: boolean;
}

/**
 * A multi-line text field in the Input's surface, wired into Field like Input is. Grows only
 * when the reader drags it.
 */
export function Textarea({ invalid, mono, className, ref, ...props }: TextareaProps) {
  return (
    <BaseInput
      render={<textarea />}
      ref={ref as never}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-20 w-full min-w-0 resize-y px-3 py-2 text-sb-base",
        fieldSurface,
        "placeholder:text-fg-muted pointer-coarse:text-[16px]",
        "read-only:bg-hover",
        focusRing,
        mono && "font-mono text-sb-sm leading-relaxed",
        className,
      )}
      {...(props as object)}
    />
  );
}
