import { Button } from "../../../src/components/button";
import { EmptyState } from "../../../src/components/empty-state";
import { InboxIcon, PlusIcon, RocketIcon } from "../../../src/lib/icons";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "With one action",
    description: "A title, one line on what goes here, and one action. A second action means it is saying too much.",
    render: () => (
      <EmptyState
        icon={<RocketIcon />}
        title="No deploys yet"
        description="Deploy robin to see its builds and logs here."
        action={
          <Button variant="primary" size="sm">
            <PlusIcon />
            Deploy robin
          </Button>
        }
      />
    ),
    code: `<EmptyState
  icon={<RocketIcon />}
  title="No deploys yet"
  description="Deploy robin to see its builds and logs here."
  action={
    <Button variant="primary" size="sm">
      <PlusIcon />
      Deploy robin
    </Button>
  }
/>`,
  },
  {
    title: "Nothing to do",
    description: "When there is no action to take, the title and one line are enough.",
    render: () => <EmptyState icon={<InboxIcon />} title="No alerts" description="finch and wren are both healthy." />,
    code: `<EmptyState
  icon={<InboxIcon />}
  title="No alerts"
  description="finch and wren are both healthy."
/>`,
  },
  {
    title: "Title only",
    render: () => <EmptyState title="No sprouts in eu-west" />,
    code: `<EmptyState title="No sprouts in eu-west" />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "EmptyState",
  controls: [
    { prop: "title", kind: "text", default: "" },
    { prop: "description", kind: "text", default: "" },
    { prop: "icon", kind: "boolean", default: false },
    { prop: "action", kind: "boolean", default: false },
    { prop: "as", kind: "select", options: ["h2", "h3", "h4"], default: "h3" },
  ],
  initial: {
    title: "No deploys yet",
    description: "Deploy robin to see its builds and logs here.",
    icon: true,
    action: true,
  },
  render: (v) => (
    <EmptyState
      title={String(v.title)}
      description={v.description ? String(v.description) : undefined}
      icon={v.icon ? <RocketIcon /> : undefined}
      action={
        v.action ? (
          <Button variant="primary" size="sm">
            Deploy robin
          </Button>
        ) : undefined
      }
      as={v.as as "h2" | "h3" | "h4"}
    />
  ),
  code: (v) => {
    const props = [
      v.icon ? "\n  icon={<RocketIcon />}" : "",
      `\n  title="${String(v.title)}"`,
      v.description ? `\n  description="${String(v.description)}"` : "",
      v.action ? `\n  action={<Button variant="primary" size="sm">Deploy robin</Button>}` : "",
      v.as !== "h3" ? `\n  as="${v.as}"` : "",
    ].join("");
    return `<EmptyState${props}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <EmptyState icon={<InboxIcon />} title="No deploys yet" className="py-0" />;
