/**
 * The accessible name for a component that has no visible label: `aria-label`, the standard
 * spelling (like Select and SegmentedControl). `ariaLabel` is the 0.1 spelling, deprecated and
 * removed in 0.3.0. One of the two is required.
 */
export type AccessibleName =
  | { "aria-label": string; /** @deprecated Use `aria-label`. */ ariaLabel?: undefined }
  | { /** @deprecated Use `aria-label`. */ ariaLabel: string; "aria-label"?: undefined };

/** Reads either spelling. */
export const accessibleName = (props: { "aria-label"?: string; ariaLabel?: string }): string =>
  props["aria-label"] ?? props.ariaLabel ?? "";
