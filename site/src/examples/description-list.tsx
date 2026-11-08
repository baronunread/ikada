import { Badge } from "../../../src/components/badge";
import { DescriptionList, type DescriptionItem } from "../../../src/components/description-list";
import type { Example, Playground, Preview } from "./types";

const items: DescriptionItem[] = [
  { id: "name", term: "Name", details: "robin" },
  { id: "region", term: "Region", details: "eu-west" },
  { id: "domain", term: "Domain", details: "robin.sproutboat.app", mono: true },
  {
    id: "status",
    term: "Status",
    details: (
      <Badge tone="success" dot live>
        Live
      </Badge>
    ),
  },
];

const itemsCode = `const items = [
  { id: "name", term: "Name", details: "robin" },
  { id: "region", term: "Region", details: "eu-west" },
  { id: "domain", term: "Domain", details: "robin.sproutboat.app", mono: true },
  {
    id: "status",
    term: "Status",
    details: (
      <Badge tone="success" dot live>
        Live
      </Badge>
    ),
  },
];`;

export const examples: Example[] = [
  {
    title: "Inline",
    description: "Terms sit beside their details once the list is 32rem wide; narrower, they stack.",
    render: () => <DescriptionList className="w-full max-w-xl" items={items} />,
    code: `${itemsCode}

<DescriptionList items={items} />`,
  },
  {
    title: "Stacked",
    description: "Each term above its details, at any width.",
    render: () => <DescriptionList className="w-full max-w-xl" items={items} layout="stacked" />,
    code: `${itemsCode}

<DescriptionList items={items} layout="stacked" />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "DescriptionList",
  controls: [{ prop: "layout", kind: "select", options: ["inline", "stacked"], default: "inline" }],
  render: (v) => (
    <DescriptionList className="w-full max-w-xl" items={items} layout={v.layout as "inline" | "stacked"} />
  ),
  code: (v) =>
    `${itemsCode}\n\n<DescriptionList items={items}${v.layout !== "inline" ? ` layout="${v.layout}"` : ""} />`,
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <DescriptionList
    className="w-60 [zoom:0.85]"
    items={[
      { id: "region", term: "Region", details: "Frankfurt" },
      { id: "runtime", term: "Runtime", details: "Node 24" },
    ]}
  />
);
