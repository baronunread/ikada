import { Button } from "../../../src/components/button";
import { PlusIcon } from "../../../src/lib/icons";
import { forcedFocus, type Example, type Playground, type Preview } from "./types";

const variants = ["primary", "secondary", "ghost", "danger"] as const;

export const examples: Example[] = [
  {
    title: "Variants",
    description: "One primary per view. Secondary is the default; ghost sits in toolbars; danger pairs with a confirm.",
    render: () =>
      variants.map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      )),
    code: `<Button variant="primary">primary</Button>
<Button>secondary</Button>
<Button variant="ghost">ghost</Button>
<Button variant="danger">danger</Button>`,
  },
  {
    title: "Sizes",
    render: () =>
      (["sm", "md", "lg"] as const).map((s) => (
        <Button key={s} size={s}>
          Size {s}
        </Button>
      )),
    code: `<Button size="sm">Size sm</Button>
<Button>Size md</Button>
<Button size="lg">Size lg</Button>`,
  },
  {
    title: "Focus",
    description: "The neutral ring, drawn without focus for this page. Tab to any button to see the real one.",
    render: () => <Button className={forcedFocus}>Focused</Button>,
    code: `<Button>Focused</Button>`,
  },
  {
    title: "Loading",
    description: "The label stays in the tree, a spinner takes its place, and the width holds.",
    render: () => (
      <Button variant="primary" loading>
        Deploy
      </Button>
    ),
    code: `<Button variant="primary" loading>
  Deploy
</Button>`,
  },
  {
    title: "Disabled",
    render: () =>
      variants.map((v) => (
        <Button key={v} variant={v} disabled>
          {v}
        </Button>
      )),
    code: `<Button variant="primary" disabled>primary</Button>
<Button disabled>secondary</Button>
<Button variant="ghost" disabled>ghost</Button>
<Button variant="danger" disabled>danger</Button>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Button",
  controls: [
    { prop: "variant", kind: "select", options: variants, default: "secondary" },
    { prop: "size", kind: "select", options: ["sm", "md", "lg"], default: "md" },
    { prop: "icon", kind: "boolean", default: false },
    { prop: "loading", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
    { prop: "children", kind: "text", default: "" },
  ],
  initial: { variant: "primary", children: "Plant sprout" },
  render: (v) => (
    <Button
      variant={v.variant as (typeof variants)[number]}
      size={v.size as "sm" | "md" | "lg"}
      loading={Boolean(v.loading)}
      disabled={Boolean(v.disabled)}
    >
      {v.icon ? <PlusIcon /> : null}
      {String(v.children)}
    </Button>
  ),
  code: (v) => {
    const props = [
      v.variant !== "secondary" ? ` variant="${v.variant}"` : "",
      v.size !== "md" ? ` size="${v.size}"` : "",
      v.loading ? " loading" : "",
      v.disabled ? " disabled" : "",
    ].join("");
    const inner = `${v.icon ? "<PlusIcon /> " : ""}${String(v.children)}`;
    return `<Button${props}>\n  ${inner}\n</Button>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex gap-2">
    <Button variant="primary">Deploy</Button>
    <Button>Cancel</Button>
  </div>
);
