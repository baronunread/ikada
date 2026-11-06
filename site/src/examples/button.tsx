import { Button } from "../../../src/components/button";
import { forcedFocus, type Example } from "./types";

const variants = ["primary", "secondary", "ghost", "danger"] as const;

export const examples: Example[] = [
  {
    title: "Variants",
    render: () =>
      variants.map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      )),
  },
  {
    title: "Sizes",
    render: () =>
      (["sm", "md", "lg"] as const).map((s) => (
        <Button key={s} size={s}>
          Size {s}
        </Button>
      )),
  },
  {
    title: "Focus",
    description: "The neutral ring, drawn without focus for this page.",
    render: () => <Button className={forcedFocus}>Focused</Button>,
  },
  {
    title: "Loading",
    render: () => (
      <Button variant="primary" loading>
        Deploy
      </Button>
    ),
  },
  {
    title: "Disabled",
    render: () =>
      variants.map((v) => (
        <Button key={v} variant={v} disabled>
          {v}
        </Button>
      )),
  },
];
