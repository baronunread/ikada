import { Badge } from "../../../src/components/badge";
import type { Example, Playground, Preview } from "./types";

const tones = ["neutral", "success", "warning", "danger", "info"] as const;

export const examples: Example[] = [
  {
    title: "Tones",
    description: "The text carries the meaning; the tone and the shape reinforce it.",
    render: () =>
      tones.map((t) => (
        <Badge key={t} tone={t}>
          {t}
        </Badge>
      )),
    code: `<Badge>neutral</Badge>
<Badge tone="success">success</Badge>
<Badge tone="warning">warning</Badge>
<Badge tone="danger">danger</Badge>
<Badge tone="info">info</Badge>`,
  },
  {
    title: "With a status shape",
    description: "Each tone has its own glyph, so colour is never the only signal.",
    render: () =>
      tones.map((t) => (
        <Badge key={t} tone={t} dot>
          {t}
        </Badge>
      )),
    code: `<Badge dot>neutral</Badge>
<Badge tone="success" dot>success</Badge>
<Badge tone="warning" dot>warning</Badge>
<Badge tone="danger" dot>danger</Badge>
<Badge tone="info" dot>info</Badge>`,
  },
  {
    title: "Live and sprout",
    description:
      "Live is the bullseye for a sprout serving traffic; sprout animates the dot in once, for something just created.",
    render: () => (
      <>
        <Badge tone="success" dot live>
          Live
        </Badge>
        <Badge tone="success" dot sprout>
          Ready
        </Badge>
      </>
    ),
    code: `<Badge tone="success" dot live>Live</Badge>
<Badge tone="success" dot sprout>Ready</Badge>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Badge",
  controls: [
    { prop: "tone", kind: "select", options: tones, default: "neutral" },
    { prop: "dot", kind: "boolean", default: false },
    { prop: "live", kind: "boolean", default: false },
    { prop: "sprout", kind: "boolean", default: false },
    { prop: "children", kind: "text", default: "" },
  ],
  initial: { tone: "success", dot: true, children: "Live" },
  render: (v) => (
    <Badge
      tone={v.tone as (typeof tones)[number]}
      dot={Boolean(v.dot)}
      live={Boolean(v.live)}
      sprout={Boolean(v.sprout)}
    >
      {String(v.children)}
    </Badge>
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-wrap justify-center gap-2">
    <Badge tone="success" dot>
      Live
    </Badge>
    <Badge tone="warning" dot>
      Degraded
    </Badge>
    <Badge>v12</Badge>
  </div>
);
