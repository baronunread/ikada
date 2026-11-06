import { CodeBlock } from "../../../src/components/code-block";
import type { Example, Playground, Preview } from "./types";

const longLine =
  "sproutboat deploy robin --region eu-west --env production --message 'Ship the new checkout flow' --wait --timeout 300";

export const examples: Example[] = [
  {
    title: "Command",
    description: "Copied as is. The label names the scroll region for screen readers and the copy button.",
    render: () => (
      <CodeBlock className="w-full max-w-lg" label="Deploy command" code="sproutboat deploy robin --region eu-west" />
    ),
    code: `<CodeBlock
  label="Deploy command"
  code="sproutboat deploy robin --region eu-west"
/>`,
  },
  {
    title: "Scrolls sideways",
    description: "Long lines scroll by default. The block is keyboard focusable so it can be read with the arrow keys.",
    render: () => <CodeBlock className="w-full max-w-lg" label="Deploy command" code={longLine} />,
    code: `<CodeBlock
  label="Deploy command"
  code="${longLine}"
/>`,
  },
  {
    title: "Wrapped",
    render: () => <CodeBlock className="w-full max-w-lg" label="Deploy command" code={longLine} wrap />,
    code: `<CodeBlock
  label="Deploy command"
  code="${longLine}"
  wrap
/>`,
  },
  {
    title: "Output without a copy button",
    render: () => (
      <CodeBlock
        className="w-full max-w-lg"
        label="Deploy output"
        copyable={false}
        code={"✓ Built wren in 4.2s\n✓ Uploaded 3 files\n✓ Live at https://wren.sproutboat.app"}
      />
    ),
    code: `<CodeBlock
  label="Deploy output"
  copyable={false}
  code={"✓ Built wren in 4.2s\\n✓ Uploaded 3 files\\n✓ Live at https://wren.sproutboat.app"}
/>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "CodeBlock",
  controls: [
    { prop: "code", kind: "text", default: "" },
    { prop: "label", kind: "text", default: "" },
    { prop: "wrap", kind: "boolean", default: false },
    { prop: "copyable", kind: "boolean", default: true },
  ],
  initial: { code: longLine, label: "Deploy command" },
  render: (v) => (
    <CodeBlock
      className="w-full max-w-lg"
      code={String(v.code)}
      label={String(v.label) || "Code"}
      wrap={Boolean(v.wrap)}
      copyable={Boolean(v.copyable)}
    />
  ),
  code: (v) => {
    const props = [
      ` label="${String(v.label) || "Code"}"`,
      ` code="${String(v.code)}"`,
      v.wrap ? " wrap" : "",
      v.copyable ? "" : " copyable={false}",
    ].join("\n  ");
    return `<CodeBlock\n ${props}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <CodeBlock className="w-60" label="Deploy" code="sproutboat deploy" />;
