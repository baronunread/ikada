import type { ReactNode } from "react";

/** One live example on a component page: a titled preview of a state or variant. */
export interface Example {
  title: string;
  description?: string;
  render: () => ReactNode;
  /**
   * The JSX a reader would write for this example: shown in the stage's Code view and copied by its
   * Copy button. Real prop names and values, no site helpers (`forcedFocus`, sample arrays defined
   * in this file are fine to reference by name if the snippet declares them). No import lines.
   */
  code: string;
}

/** Draws the keyboard focus ring without focus, so a static page can show the state. */
export const forcedFocus = "outline-solid outline-2 outline-offset-2 outline-focus";

/**
 * A component's compact render for its tile on the overview: small, static (it is rendered on the
 * server without hydration), and showing the component at rest.
 */
export type Preview = () => ReactNode;

export type PlaygroundValue = string | boolean | number;
export type PlaygroundValues = Record<string, PlaygroundValue>;

/**
 * One editable prop in the playground. `default` is the component's own default: when the control
 * holds it, the prop is left out of the code, as a reader would leave it out. `children` is a
 * prop like any other here, written between the tags.
 */
export type Control =
  | { prop: string; kind: "select"; options: readonly string[]; default?: string }
  | { prop: string; kind: "boolean"; default?: boolean }
  | { prop: string; kind: "text"; default?: string }
  | { prop: string; kind: "number"; min: number; max: number; step?: number; default?: number };

/** The prop playground at the top of a component page: live props that rewrite the code. */
export interface Playground {
  /** The component as it is imported, e.g. "Button". */
  component: string;
  /** The editable props, in display order. Keep it to the props that change what you see (3–6). */
  controls: readonly Control[];
  /** Starting values; a control missing here starts at its `default`. */
  initial?: PlaygroundValues;
  /**
   * Props always written into the code (an aria-label, an onClick handler). Code only: pass them
   * yourself in `render`. A value wrapped in braces is written as an expression: `{ onClick: "{plant}" }`
   * → `onClick={plant}`; anything else as a string: `aria-label="Close"`.
   */
  fixed?: Record<string, string>;
  /** The live preview for the current values. */
  render: (values: PlaygroundValues) => ReactNode;
  /**
   * Writes the code for the current values when it is more than one element (a Dialog with its
   * trigger, a Select with items). Without it the code is `<Component …changed props>children</Component>`.
   */
  code?: (values: PlaygroundValues) => string;
}
