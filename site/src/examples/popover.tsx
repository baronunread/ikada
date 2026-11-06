import { Button } from "../../../src/components/button";
import { Field } from "../../../src/components/field";
import { Input } from "../../../src/components/input";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "../../../src/components/popover";
import type { Example, Playground, Preview } from "./types";

const sides = ["top", "bottom", "left", "right"] as const;
const aligns = ["start", "center", "end"] as const;

export const examples: Example[] = [
  {
    title: "Rollout",
    description: "Interactive content anchored to its trigger. Plain text belongs in a Tooltip.",
    render: () => (
      <Popover>
        <PopoverTrigger render={<Button />}>Rollout</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Rollout</PopoverTitle>
          <PopoverDescription>Send 10% of traffic to the new version first.</PopoverDescription>
        </PopoverContent>
      </Popover>
    ),
    code: `<Popover>
  <PopoverTrigger render={<Button />}>Rollout</PopoverTrigger>
  <PopoverContent>
    <PopoverTitle>Rollout</PopoverTitle>
    <PopoverDescription>Send 10% of traffic to the new version first.</PopoverDescription>
  </PopoverContent>
</Popover>`,
  },
  {
    title: "Small form",
    description: "PopoverClose closes it from inside, for a confirming button.",
    render: () => (
      <Popover>
        <PopoverTrigger render={<Button />}>Rename</PopoverTrigger>
        <PopoverContent className="flex flex-col gap-3">
          <Field label="Sprout name">
            <Input defaultValue="robin" />
          </Field>
          <div className="flex justify-end gap-2">
            <PopoverClose render={<Button size="sm" variant="ghost" />}>Cancel</PopoverClose>
            <PopoverClose render={<Button size="sm" variant="primary" />}>Save</PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    ),
    code: `<Popover>
  <PopoverTrigger render={<Button />}>Rename</PopoverTrigger>
  <PopoverContent className="flex flex-col gap-3">
    <Field label="Sprout name">
      <Input defaultValue="robin" />
    </Field>
    <div className="flex justify-end gap-2">
      <PopoverClose render={<Button size="sm" variant="ghost" />}>Cancel</PopoverClose>
      <PopoverClose render={<Button size="sm" variant="primary" />}>Save</PopoverClose>
    </div>
  </PopoverContent>
</Popover>`,
  },
  {
    title: "Placement",
    description: "Choose the side and alignment; it flips when there is no room.",
    render: () => (
      <Popover>
        <PopoverTrigger render={<Button />}>Regions</PopoverTrigger>
        <PopoverContent side="right" align="center">
          <PopoverTitle>Regions</PopoverTitle>
          <PopoverDescription>wren runs in eu-west and us-east.</PopoverDescription>
        </PopoverContent>
      </Popover>
    ),
    code: `<Popover>
  <PopoverTrigger render={<Button />}>Regions</PopoverTrigger>
  <PopoverContent side="right" align="center">
    <PopoverTitle>Regions</PopoverTitle>
    <PopoverDescription>wren runs in eu-west and us-east.</PopoverDescription>
  </PopoverContent>
</Popover>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "PopoverContent",
  controls: [
    { prop: "side", kind: "select", options: sides, default: "bottom" },
    { prop: "align", kind: "select", options: aligns, default: "start" },
  ],
  initial: { side: "right", align: "center" },
  render: (v) => (
    <Popover>
      <PopoverTrigger render={<Button />}>Rollout</PopoverTrigger>
      <PopoverContent side={v.side as (typeof sides)[number]} align={v.align as (typeof aligns)[number]}>
        <PopoverTitle>Rollout</PopoverTitle>
        <PopoverDescription>Send 10% of traffic to the new version first.</PopoverDescription>
      </PopoverContent>
    </Popover>
  ),
  code: (v) => {
    const props = `${v.side !== "bottom" ? ` side="${v.side}"` : ""}${v.align !== "start" ? ` align="${v.align}"` : ""}`;
    return `<Popover>
  <PopoverTrigger render={<Button />}>Rollout</PopoverTrigger>
  <PopoverContent${props}>
    <PopoverTitle>Rollout</PopoverTitle>
    <PopoverDescription>Send 10% of traffic to the new version first.</PopoverDescription>
  </PopoverContent>
</Popover>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-start gap-2">
    <Button size="sm">Rollout</Button>
    <div className="w-52 rounded-xl bg-raised p-3 text-sm shadow-float">
      <p className="font-semibold">Rollout</p>
      <p className="text-fg-muted">Send 10% of traffic first.</p>
    </div>
  </div>
);
