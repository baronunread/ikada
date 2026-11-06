import { Button } from "../../../src/components/button";
import { Tooltip } from "../../../src/components/tooltip";
import type { Example, Playground, Preview } from "./types";

const sides = ["top", "bottom", "start", "end"] as const;

export const examples: Example[] = [
  {
    title: "Default",
    description: "Short plain text on hover or focus, after a delay. Anything interactive belongs in a Popover.",
    render: () => (
      <Tooltip content="Roll back to v47">
        <Button>Roll back</Button>
      </Tooltip>
    ),
    code: `<Tooltip content="Roll back to v47">
  <Button>Roll back</Button>
</Tooltip>`,
  },
  {
    title: "Sides",
    render: () => (
      <>
        {sides.map((side) => (
          <Tooltip key={side} content={`Opens on the ${side}`} side={side}>
            <Button>{side}</Button>
          </Tooltip>
        ))}
      </>
    ),
    code: `<Tooltip content="Opens on the top" side="top">
  <Button>top</Button>
</Tooltip>
<Tooltip content="Opens on the bottom" side="bottom">
  <Button>bottom</Button>
</Tooltip>
<Tooltip content="Opens on the start" side="start">
  <Button>start</Button>
</Tooltip>
<Tooltip content="Opens on the end" side="end">
  <Button>end</Button>
</Tooltip>`,
  },
  {
    title: "No delay",
    description: "Skip the 450ms wait for a control that has no other label.",
    render: () => (
      <Tooltip content="Copy robin.sproutboat.app" delay={0}>
        <Button>Copy</Button>
      </Tooltip>
    ),
    code: `<Tooltip content="Copy robin.sproutboat.app" delay={0}>
  <Button>Copy</Button>
</Tooltip>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Tooltip",
  controls: [
    { prop: "content", kind: "text" },
    { prop: "side", kind: "select", options: sides, default: "top" },
    { prop: "delay", kind: "number", min: 0, max: 1000, step: 50, default: 450 },
  ],
  initial: { content: "Roll back to v47" },
  render: (v) => (
    <Tooltip content={String(v.content)} side={v.side as (typeof sides)[number]} delay={Number(v.delay)}>
      <Button>Roll back</Button>
    </Tooltip>
  ),
  code: (v) => {
    const props = `${v.side !== "top" ? ` side="${v.side}"` : ""}${v.delay !== 450 ? ` delay={${v.delay}}` : ""}`;
    return `<Tooltip content="${v.content}"${props}>\n  <Button>Roll back</Button>\n</Tooltip>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-center gap-1.5">
    <span className="rounded-md bg-raised px-2 py-1 text-xs shadow-float">Roll back to v47</span>
    <Button size="sm">Roll back</Button>
  </div>
);
