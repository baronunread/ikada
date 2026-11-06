/**
 * The ikada mark: a raft seen from above, three staggered logs bound by two lashings.
 * Site-only. The library has no brand export (the dashboards carry the Sproutboat mark), so
 * this stays out of src/ and out of the shadcn registry. Draws in currentColor.
 */
import { useId, type ComponentProps } from "react";

export interface IkadaMarkProps extends Omit<ComponentProps<"svg">, "width" | "height" | "viewBox" | "children"> {
  /** Width and height in px, or any CSS length. */
  size?: number | string;
  /** Accessible name. Without it the mark is decorative and hidden from assistive tech. */
  title?: string;
}

export function IkadaMark({ size = 24, title, ...props }: IkadaMarkProps) {
  const mask = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      focusable="false"
      {...(title ? { role: "img" } : { "aria-hidden": true })}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <mask id={mask}>
          <rect width="24" height="24" fill="#fff" />
          <path d="M8.25 0V24M15.75 0V24" stroke="#000" strokeWidth="1.5" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`} fill="currentColor">
        <rect x="2" y="4.5" width="18.5" height="4.5" rx="2.25" />
        <rect x="3.5" y="10.5" width="18.5" height="4.5" rx="2.25" />
        <rect x="2" y="16.5" width="19.5" height="4.5" rx="2.25" />
      </g>
    </svg>
  );
}
