import { Button } from "../../../src/components/button";
import { InlineConfirm } from "../../../src/components/inline-confirm";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Bubble",
    description:
      "Floats above the control and never moves the layout. A polite live region announces the word. The control calls confirm() when the action succeeded.",
    render: () => (
      <InlineConfirm message="Saved">{({ confirm }) => <Button onClick={confirm}>Save settings</Button>}</InlineConfirm>
    ),
    code: `<InlineConfirm message="Saved">
  {({ confirm }) => <Button onClick={confirm}>Save settings</Button>}
</InlineConfirm>`,
  },
  {
    title: "Inline",
    description: "Sits beside the control in a reserved slot, for a row where a bubble would be clipped.",
    render: () => (
      <InlineConfirm message="Saved" appearance="inline">
        {({ confirm }) => <Button onClick={confirm}>Save settings</Button>}
      </InlineConfirm>
    ),
    code: `<InlineConfirm message="Saved" appearance="inline">
  {({ confirm }) => <Button onClick={confirm}>Save settings</Button>}
</InlineConfirm>`,
  },
  {
    title: "Different announcement",
    description: "`announce` is what screen readers hear when it differs from the visible word.",
    render: () => (
      <InlineConfirm message="Copied" announce="Deploy URL copied to clipboard">
        {({ confirm }) => <Button onClick={confirm}>Copy URL</Button>}
      </InlineConfirm>
    ),
    code: `<InlineConfirm message="Copied" announce="Deploy URL copied to clipboard">
  {({ confirm }) => <Button onClick={confirm}>Copy URL</Button>}
</InlineConfirm>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "InlineConfirm",
  controls: [
    { prop: "message", kind: "text", default: "" },
    { prop: "appearance", kind: "select", options: ["bubble", "inline"], default: "bubble" },
    { prop: "duration", kind: "number", min: 600, max: 4000, step: 200, default: 1600 },
  ],
  initial: { message: "Saved" },
  render: (v) => (
    <InlineConfirm
      message={String(v.message) || "Saved"}
      appearance={v.appearance as "bubble" | "inline"}
      duration={Number(v.duration)}
    >
      {({ confirm }) => <Button onClick={confirm}>Save settings</Button>}
    </InlineConfirm>
  ),
  code: (v) => {
    const props = [
      ` message="${String(v.message) || "Saved"}"`,
      v.appearance !== "bubble" ? ` appearance="${v.appearance}"` : "",
      Number(v.duration) !== 1600 ? ` duration={${Number(v.duration)}}` : "",
    ].join("");
    return `<InlineConfirm${props}>\n  {({ confirm }) => <Button onClick={confirm}>Save settings</Button>}\n</InlineConfirm>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2 text-sb-sm">
    <span className="text-fg-muted">Press again to delete</span>
    <Button size="sm" variant="danger">
      Delete
    </Button>
  </div>
);
