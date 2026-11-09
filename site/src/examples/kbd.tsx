import { Kbd } from "../../../src/components/kbd";
import type { Example, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Keys",
    description: "A keycap for shortcut hints. Decorative text: the control it sits in carries aria-keyshortcuts.",
    render: () => (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <Kbd>Esc</Kbd>
        <Kbd>↵</Kbd>
      </>
    ),
    code: `<Kbd>⌘</Kbd>
<Kbd>K</Kbd>
<Kbd>Esc</Kbd>
<Kbd>↵</Kbd>`,
  },
  {
    title: "In a hint",
    render: () => (
      <p className="flex items-center gap-1.5 text-sb-sm text-fg-muted">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span className="ms-1">to search sprouts</span>
      </p>
    ),
    code: `<p className="flex items-center gap-1.5 text-sb-sm text-fg-muted">
  <Kbd>⌘</Kbd>
  <Kbd>K</Kbd>
  <span className="ms-1">to search sprouts</span>
</p>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-1.5 text-sb-sm text-fg-muted">
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
    <span className="ms-1">to search</span>
  </div>
);
