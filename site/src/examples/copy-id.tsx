import { CopyId } from "../../../src/components/copy-id";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Default",
    description: "The copy icon turns into a check, and “Copied” appears above it. Nothing is added to the toasts.",
    render: () => <CopyId value="dpl_8f3a91c2" />,
    code: `<CopyId value="dpl_8f3a91c2" />`,
  },
  {
    title: "Shortened hash",
    description: "`display` shortens what is shown; the full value is what gets copied and shown on hover.",
    render: () => (
      <CopyId value="3f9a1c7e5b2d4a80c6e1f7d93b5a2c48e0d1f6a7" display="3f9a1c7" label="Copy commit hash" />
    ),
    code: `<CopyId
  value="3f9a1c7e5b2d4a80c6e1f7d93b5a2c48e0d1f6a7"
  display="3f9a1c7"
  label="Copy commit hash"
/>`,
  },
  {
    title: "Truncates in a narrow space",
    render: () => (
      <CopyId className="w-48" value="https://robin.sproutboat.app/hooks/deploy-finished" label="Copy webhook URL" />
    ),
    code: `<CopyId
  className="w-48"
  value="https://robin.sproutboat.app/hooks/deploy-finished"
  label="Copy webhook URL"
/>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "CopyId",
  controls: [
    { prop: "value", kind: "text", default: "" },
    { prop: "display", kind: "text", default: "" },
    { prop: "label", kind: "text", default: "Copy ID" },
  ],
  initial: { value: "3f9a1c7e5b2d4a80c6e1f7d93b5a2c48e0d1f6a7", display: "3f9a1c7", label: "Copy commit hash" },
  render: (v) => (
    <CopyId
      value={String(v.value)}
      display={v.display ? String(v.display) : undefined}
      label={String(v.label) || undefined}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <CopyId value="dpl_8f3a91c2" />;
