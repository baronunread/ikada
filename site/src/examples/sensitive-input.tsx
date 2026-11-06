import { Field } from "../../../src/components/field";
import { SensitiveInput } from "../../../src/components/sensitive-input";
import type { Example, Playground, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "In a Field",
    description: "Masked until the eye button is pressed. The label and description are wired by Field.",
    render: () => (
      <Field label="API token" description="Shown once. Store it somewhere safe." className="max-w-80">
        <SensitiveInput defaultValue="sb_live_2f9a41c7" mono />
      </Field>
    ),
    code: `<Field label="API token" description="Shown once. Store it somewhere safe.">
  <SensitiveInput defaultValue="sb_live_2f9a41c7" mono />
</Field>`,
  },
  {
    title: "Copyable",
    description: "The copy button copies the real value even while it is masked.",
    render: () => (
      <Field label="Webhook secret" className="max-w-80">
        <SensitiveInput defaultValue="whsec_robin_8d31" mono copyable />
      </Field>
    ),
    code: `<Field label="Webhook secret">
  <SensitiveInput defaultValue="whsec_robin_8d31" mono copyable />
</Field>`,
  },
  {
    title: "Revealed",
    render: () => (
      <Field label="Deploy key" className="max-w-80">
        <SensitiveInput defaultValue="sb_deploy_wren_c04e" defaultRevealed mono copyable />
      </Field>
    ),
    code: `<Field label="Deploy key">
  <SensitiveInput defaultValue="sb_deploy_wren_c04e" defaultRevealed mono copyable />
</Field>`,
  },
  {
    title: "Error",
    render: () => (
      <Field label="Password" error="Use at least 12 characters." className="max-w-80">
        <SensitiveInput defaultValue="hunter2" autoComplete="new-password" />
      </Field>
    ),
    code: `<Field label="Password" error="Use at least 12 characters.">
  <SensitiveInput defaultValue="hunter2" autoComplete="new-password" />
</Field>`,
  },
  {
    title: "Disabled",
    render: () => (
      <Field label="API token" className="max-w-80">
        <SensitiveInput defaultValue="sb_live_2f9a41c7" mono disabled />
      </Field>
    ),
    code: `<Field label="API token">
  <SensitiveInput defaultValue="sb_live_2f9a41c7" mono disabled />
</Field>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "SensitiveInput",
  controls: [
    { prop: "copyable", kind: "boolean", default: false },
    { prop: "defaultRevealed", kind: "boolean", default: false },
    { prop: "mono", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { copyable: true, mono: true },
  fixed: { "aria-label": "API token", defaultValue: "sb_live_2f9a41c7" },
  render: (v) => (
    <div className="w-full max-w-80">
      <SensitiveInput
        // defaultRevealed only applies on mount.
        key={String(v.defaultRevealed)}
        aria-label="API token"
        defaultValue="sb_live_2f9a41c7"
        copyable={Boolean(v.copyable)}
        defaultRevealed={Boolean(v.defaultRevealed)}
        mono={Boolean(v.mono)}
        disabled={Boolean(v.disabled)}
      />
    </div>
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <SensitiveInput aria-label="Token" defaultValue="sb_live_2f9a" mono className="w-60" />
);
