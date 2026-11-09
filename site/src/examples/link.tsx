import { Link } from "../../../src/components/link";
import { demo } from "../lib/demo-href";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Inline",
    render: () => (
      <p className="text-sb-base">
        Read the <Link href={demo.installation}>deploy guide</Link> before moving robin to eu-west.
      </p>
    ),
    code: `<p>
  Read the <Link href="/docs/deploys">deploy guide</Link> before moving robin to eu-west.
</p>`,
  },
  {
    title: "External",
    description: "Opens in a new tab with a safe rel, shows an arrow, and tells screen readers.",
    render: () => (
      <Link href="https://robin.sproutboat.app" external>
        robin.sproutboat.app
      </Link>
    ),
    code: `<Link href="https://robin.sproutboat.app" external>
  robin.sproutboat.app
</Link>`,
  },
  {
    title: "Disabled",
    render: () => (
      <Link href={demo.installation} aria-disabled="true">
        Deploy guide
      </Link>
    ),
    code: `<Link href="/docs/deploys" aria-disabled="true">
  Deploy guide
</Link>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Link",
  controls: [
    { prop: "children", kind: "text", default: "" },
    { prop: "external", kind: "boolean", default: false },
  ],
  initial: { children: "Read the docs" },
  fixed: { href: "/docs" },
  render: (v) => (
    <Link href={demo.docs} external={Boolean(v.external)}>
      {String(v.children)}
    </Link>
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-center gap-1">
    <Link href={demo.docs}>Read the docs</Link>
    <Link href="https://sproutboat.com" external>
      sproutboat.com
    </Link>
  </div>
);
