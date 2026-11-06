import { Avatar } from "../../../src/components/avatar";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Sizes",
    description: "24, 32 and 48px. The first letter of the name stands in when there is no picture.",
    render: () => (
      <div className="flex items-center gap-3">
        <Avatar name="robin" size="sm" />
        <Avatar name="wren" />
        <Avatar name="finch" size="lg" />
      </div>
    ),
    code: `<Avatar name="robin" size="sm" />
<Avatar name="wren" />
<Avatar name="finch" size="lg" />`,
  },
  {
    title: "Next to a name",
    description: "Decorative beside a visible name: the initial is hidden from screen readers.",
    render: () => (
      <div className="flex items-center gap-2.5">
        <Avatar name="heron" />
        <span className="text-base font-medium">heron</span>
      </div>
    ),
    code: `<div className="flex items-center gap-2.5">
  <Avatar name="heron" />
  <span className="text-base font-medium">heron</span>
</div>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Avatar",
  controls: [
    { prop: "size", kind: "select", options: ["sm", "md", "lg"], default: "md" },
    { prop: "name", kind: "text", default: "" },
  ],
  initial: { size: "lg", name: "robin" },
  render: (v) => <Avatar name={String(v.name)} size={v.size as "sm" | "md" | "lg"} />,
  code: (v) => `<Avatar name="${String(v.name)}"${v.size !== "md" ? ` size="${v.size}"` : ""} />`,
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2">
    <Avatar name="mika" size="sm" />
    <Avatar name="andrea" />
    <Avatar name="rowan" size="lg" />
  </div>
);
