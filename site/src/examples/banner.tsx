import { Banner } from "../../../src/components/banner";
import { Button } from "../../../src/components/button";
import type { Example, Playground, Preview } from "./types";

const tones = ["info", "success", "warning", "danger", "neutral"] as const;

export const examples: Example[] = [
  {
    title: "Tones",
    description: "Danger interrupts screen readers as an alert; every other tone is polite.",
    render: () => (
      <div className="flex w-full flex-col gap-3">
        <Banner title="Deploys use the new runtime">robin picks it up on the next deploy.</Banner>
        <Banner tone="success" title="Domain verified">
          robin.sproutboat.app is serving traffic.
        </Banner>
        <Banner tone="warning" title="Storage is at 91%">
          Writes pause at the limit.
        </Banner>
        <Banner tone="danger" title="Deploy blocked">
          wren failed its health check in eu-west.
        </Banner>
      </div>
    ),
    code: `<Banner title="Deploys use the new runtime">
  robin picks it up on the next deploy.
</Banner>
<Banner tone="success" title="Domain verified">
  robin.sproutboat.app is serving traffic.
</Banner>
<Banner tone="warning" title="Storage is at 91%">
  Writes pause at the limit.
</Banner>
<Banner tone="danger" title="Deploy blocked">
  wren failed its health check in eu-west.
</Banner>`,
  },
  {
    title: "With an action",
    description: "One action, usually a Button or a Link.",
    render: () => (
      <Banner tone="warning" title="DNS pending" action={<Button size="sm">Check records</Button>} className="w-full">
        Add the CNAME record for robin.sproutboat.app to finish.
      </Banner>
    ),
    code: `<Banner
  tone="warning"
  title="DNS pending"
  action={<Button size="sm">Check records</Button>}
>
  Add the CNAME record for robin.sproutboat.app to finish.
</Banner>`,
  },
  {
    title: "Dismissible",
    description: "The close button hides the banner and calls onDismiss. Reload the page to bring it back.",
    render: () => (
      <Banner dismissible title="New region" className="w-full">
        us-east is open for new sprouts.
      </Banner>
    ),
    code: `<Banner dismissible title="New region">
  us-east is open for new sprouts.
</Banner>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Banner",
  controls: [
    { prop: "tone", kind: "select", options: tones, default: "info" },
    { prop: "title", kind: "text", default: "" },
    { prop: "dismissible", kind: "boolean", default: false },
    { prop: "children", kind: "text", default: "" },
  ],
  initial: { tone: "warning", title: "Storage is at 91%", children: "Writes pause at the limit." },
  render: (v) => (
    // Keyed on the values so a dismissed banner comes back when a control changes.
    <Banner
      key={JSON.stringify(v)}
      tone={v.tone as (typeof tones)[number]}
      title={v.title ? String(v.title) : undefined}
      dismissible={Boolean(v.dismissible)}
      className="w-full"
    >
      {String(v.children)}
    </Banner>
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Banner tone="warning" title="DNS pending" className="w-60">
    Add the CNAME record to finish.
  </Banner>
);
