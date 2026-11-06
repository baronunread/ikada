import { useState } from "react";
import { SegmentedControl } from "../../../src/components/segmented-control";
import type { Example, Preview } from "./types";

const ranges = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;

function Range({ size }: { size?: "sm" | "md" }) {
  const [value, setValue] = useState<string>("24h");
  return (
    <div className="w-full max-w-72">
      <SegmentedControl aria-label="Range" options={ranges} value={value} onValueChange={setValue} size={size} />
    </div>
  );
}

export const examples: Example[] = [
  {
    title: "Range",
    description: "One raised pebble on a recessed tray slides to the choice on the snappy spring.",
    render: () => <Range />,
  },
  { title: "Small", render: () => <Range size="sm" /> },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="w-56">
    <SegmentedControl aria-label="Range" options={ranges} value="24h" onValueChange={() => {}} />
  </div>
);
