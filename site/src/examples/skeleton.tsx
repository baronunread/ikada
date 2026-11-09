import { Skeleton } from "../../../src/components/skeleton";
import type { Example, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Lines",
    description:
      "Siblings start 120ms apart, so a block of lines swells top to bottom. Decorative: mark the region aria-busy.",
    render: () => (
      <div aria-busy="true" className="flex w-56 flex-col gap-2">
        <Skeleton className="w-3/4" />
        <Skeleton />
        <Skeleton className="w-1/2" />
      </div>
    ),
    code: `<div aria-busy="true" className="flex w-56 flex-col gap-2">
  <Skeleton className="w-3/4" />
  <Skeleton />
  <Skeleton className="w-1/2" />
</div>`,
  },
  {
    title: "Kinds",
    description: "Line is the default; block stands in for a chart or image, circle for an avatar.",
    render: () => (
      <div className="flex w-56 flex-col gap-3">
        <Skeleton variant="line" />
        <Skeleton variant="block" />
        <Skeleton variant="circle" />
      </div>
    ),
    code: `<Skeleton variant="line" />
<Skeleton variant="block" />
<Skeleton variant="circle" />`,
  },
  {
    title: "Sprout row",
    description: "Keep the layout of the loaded row so nothing jumps when the data arrives.",
    render: () => (
      <div aria-busy="true" className="flex w-64 items-center gap-3">
        <Skeleton variant="circle" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="w-24" />
          <Skeleton className="w-40" />
        </div>
      </div>
    ),
    code: `<div aria-busy="true" className="flex items-center gap-3">
  <Skeleton variant="circle" />
  <div className="flex flex-1 flex-col gap-2">
    <Skeleton className="w-24" />
    <Skeleton className="w-40" />
  </div>
</div>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-56 flex-col gap-2">
    <Skeleton className="w-3/4" />
    <Skeleton />
    <Skeleton className="w-1/2" />
  </div>
);
