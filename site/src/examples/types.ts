import type { ReactNode } from "react";

/** One live example on a component page: a titled preview of a state or variant. */
export interface Example {
  title: string;
  description?: string;
  render: () => ReactNode;
}

/** Draws the keyboard focus ring without focus, so a static page can show the state. */
export const forcedFocus = "outline-solid outline-2 outline-offset-2 outline-focus";
