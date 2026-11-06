import { IconButton } from "../../../src/components/icon-button";
import { CopyIcon, MoreIcon, RefreshIcon, TrashIcon } from "../../../src/lib/icons";
import type { Example, Playground, Preview } from "./types";

const variants = ["primary", "secondary", "ghost", "danger"] as const;

export const examples: Example[] = [
  {
    title: "Variants",
    description: "Ghost is the default: icon buttons sit in toolbars and rows. The label is the name and the tooltip.",
    render: () => (
      <>
        <IconButton label="Refresh" variant="primary">
          <RefreshIcon />
        </IconButton>
        <IconButton label="Copy" variant="secondary">
          <CopyIcon />
        </IconButton>
        <IconButton label="More">
          <MoreIcon />
        </IconButton>
        <IconButton label="Delete" variant="danger">
          <TrashIcon />
        </IconButton>
      </>
    ),
    code: `<IconButton label="Refresh" variant="primary">
  <RefreshIcon />
</IconButton>
<IconButton label="Copy" variant="secondary">
  <CopyIcon />
</IconButton>
<IconButton label="More">
  <MoreIcon />
</IconButton>
<IconButton label="Delete" variant="danger">
  <TrashIcon />
</IconButton>`,
  },
  {
    title: "Sizes",
    render: () =>
      (["sm", "md", "lg"] as const).map((s) => (
        <IconButton key={s} label={`Refresh (${s})`} size={s} variant="secondary">
          <RefreshIcon />
        </IconButton>
      )),
    code: `<IconButton label="Refresh (sm)" size="sm" variant="secondary">
  <RefreshIcon />
</IconButton>
<IconButton label="Refresh (md)" size="md" variant="secondary">
  <RefreshIcon />
</IconButton>
<IconButton label="Refresh (lg)" size="lg" variant="secondary">
  <RefreshIcon />
</IconButton>`,
  },
  {
    title: "Without a tooltip",
    description:
      "Set tooltip={false} when a parent already explains the button. The label is still its accessible name.",
    render: () => (
      <IconButton label="Copy deploy URL" tooltip={false}>
        <CopyIcon />
      </IconButton>
    ),
    code: `<IconButton label="Copy deploy URL" tooltip={false}>
  <CopyIcon />
</IconButton>`,
  },
  {
    title: "Disabled",
    render: () => (
      <IconButton label="Delete" variant="danger" disabled>
        <TrashIcon />
      </IconButton>
    ),
    code: `<IconButton label="Delete" variant="danger" disabled>
  <TrashIcon />
</IconButton>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "IconButton",
  controls: [
    { prop: "label", kind: "text", default: "" },
    { prop: "variant", kind: "select", options: variants, default: "ghost" },
    { prop: "size", kind: "select", options: ["sm", "md", "lg"], default: "md" },
    { prop: "tooltip", kind: "boolean", default: true },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { label: "Refresh", variant: "secondary" },
  render: (v) => (
    <IconButton
      label={String(v.label) || "Action"}
      variant={v.variant as (typeof variants)[number]}
      size={v.size as "sm" | "md" | "lg"}
      tooltip={Boolean(v.tooltip)}
      disabled={Boolean(v.disabled)}
    >
      <RefreshIcon />
    </IconButton>
  ),
  code: (v) => {
    const props = [
      ` label="${String(v.label) || "Action"}"`,
      v.variant !== "ghost" ? ` variant="${v.variant}"` : "",
      v.size !== "md" ? ` size="${v.size}"` : "",
      v.tooltip ? "" : " tooltip={false}",
      v.disabled ? " disabled" : "",
    ].join("");
    return `<IconButton${props}>\n  <RefreshIcon />\n</IconButton>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex gap-1">
    <IconButton label="Copy">
      <CopyIcon />
    </IconButton>
    <IconButton label="Refresh" variant="secondary">
      <RefreshIcon />
    </IconButton>
    <IconButton label="More">
      <MoreIcon />
    </IconButton>
  </div>
);
