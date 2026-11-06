import { Breadcrumbs } from "../../../src/components/breadcrumbs";
import type { Example, Playground, Preview } from "./types";

const trail = [
  { label: "acme", href: "#acme" },
  { label: "robin", href: "#robin" },
  { label: "production", href: "#production" },
  { label: "eu-west", href: "#eu-west" },
  { label: "Logs" },
];

const trailCode = `const items = [
  { label: "acme", href: "/acme" },
  { label: "robin", href: "/acme/robin" },
  { label: "production", href: "/acme/robin/production" },
  { label: "eu-west", href: "/acme/robin/production/eu-west" },
  { label: "Logs" },
];`;

export const examples: Example[] = [
  {
    title: "Trail",
    description: "Root first. The last item is the current page: plain text, marked aria-current.",
    render: () => (
      <Breadcrumbs items={[{ label: "acme", href: "#acme" }, { label: "robin", href: "#robin" }, { label: "Logs" }]} />
    ),
    code: `<Breadcrumbs
  items={[
    { label: "acme", href: "/acme" },
    { label: "robin", href: "/acme/robin" },
    { label: "Logs" },
  ]}
/>`,
  },
  {
    title: "Collapsed",
    description: "Past maxItems (4 by default) the middle levels fold into a menu. The first and last always show.",
    render: () => <Breadcrumbs items={trail} />,
    code: `${trailCode}

<Breadcrumbs items={items} />`,
  },
  {
    title: "Wider limit",
    render: () => <Breadcrumbs items={trail} maxItems={5} />,
    code: `${trailCode}

<Breadcrumbs items={items} maxItems={5} />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Breadcrumbs",
  controls: [{ prop: "maxItems", kind: "number", min: 2, max: 5, step: 1, default: 4 }],
  initial: { maxItems: 3 },
  render: (v) => <Breadcrumbs items={trail} maxItems={Number(v.maxItems)} />,
  code: (v) =>
    `${trailCode}\n\n<Breadcrumbs items={items}${Number(v.maxItems) !== 4 ? ` maxItems={${Number(v.maxItems)}}` : ""} />`,
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Breadcrumbs items={[{ label: "acme", href: "#acme" }, { label: "web", href: "#web" }, { label: "Logs" }]} />
);
