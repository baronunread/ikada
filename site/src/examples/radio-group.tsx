import { RadioGroup } from "../../../src/components/radio-group";
import type { Example, Playground, Preview } from "./types";

const plans = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
];

export const examples: Example[] = [
  {
    title: "Vertical",
    description: "Arrow keys move and select; Tab leaves the group.",
    render: () => <RadioGroup legend="Plan" defaultValue="free" options={plans} />,
    code: `<RadioGroup
  legend="Plan"
  defaultValue="free"
  options={[
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
  ]}
/>`,
  },
  {
    title: "Descriptions",
    render: () => (
      <RadioGroup
        legend="Region"
        defaultValue="eu-west"
        options={[
          { value: "eu-west", label: "eu-west", description: "Frankfurt. Closest to most of your readers." },
          { value: "us-east", label: "us-east", description: "Virginia." },
          { value: "ap-south", label: "ap-south", description: "Singapore. Not open yet.", disabled: true },
        ]}
      />
    ),
    code: `<RadioGroup
  legend="Region"
  defaultValue="eu-west"
  options={[
    { value: "eu-west", label: "eu-west", description: "Frankfurt. Closest to most of your readers." },
    { value: "us-east", label: "us-east", description: "Virginia." },
    { value: "ap-south", label: "ap-south", description: "Singapore. Not open yet.", disabled: true },
  ]}
/>`,
  },
  {
    title: "Horizontal",
    render: () => (
      <RadioGroup
        legend="Visibility"
        orientation="horizontal"
        defaultValue="private"
        options={[
          { value: "private", label: "Private" },
          { value: "team", label: "Team" },
          { value: "public", label: "Public" },
        ]}
      />
    ),
    code: `<RadioGroup
  legend="Visibility"
  orientation="horizontal"
  defaultValue="private"
  options={[
    { value: "private", label: "Private" },
    { value: "team", label: "Team" },
    { value: "public", label: "Public" },
  ]}
/>`,
  },
  {
    title: "Invalid",
    render: () => <RadioGroup legend="Plan" invalid options={plans} />,
    code: `<RadioGroup
  legend="Plan"
  invalid
  options={[
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
  ]}
/>`,
  },
  {
    title: "Disabled",
    render: () => <RadioGroup legend="Plan" defaultValue="pro" disabled options={plans} />,
    code: `<RadioGroup
  legend="Plan"
  defaultValue="pro"
  disabled
  options={[
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
  ]}
/>`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "RadioGroup",
  controls: [
    { prop: "legend", kind: "text", default: "" },
    { prop: "orientation", kind: "select", options: ["vertical", "horizontal"], default: "vertical" },
    { prop: "invalid", kind: "boolean", default: false },
    { prop: "disabled", kind: "boolean", default: false },
  ],
  initial: { legend: "Plan" },
  render: (v) => (
    <RadioGroup
      aria-label="Plan"
      legend={v.legend ? String(v.legend) : undefined}
      orientation={v.orientation as "vertical" | "horizontal"}
      invalid={Boolean(v.invalid)}
      disabled={Boolean(v.disabled)}
      defaultValue="free"
      options={plans}
    />
  ),
  code: (v) => {
    const props = [
      v.legend ? `  legend="${v.legend}"` : `  aria-label="Plan"`,
      v.orientation !== "vertical" ? `  orientation="${v.orientation}"` : "",
      v.invalid ? "  invalid" : "",
      v.disabled ? "  disabled" : "",
      `  defaultValue="free"`,
      `  options={[\n    { value: "free", label: "Free" },\n    { value: "pro", label: "Pro" },\n  ]}`,
    ].filter(Boolean);
    return `<RadioGroup\n${props.join("\n")}\n/>`;
  },
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <RadioGroup
    aria-label="Plan"
    defaultValue="free"
    options={[
      { value: "free", label: "Free" },
      { value: "pro", label: "Pro" },
    ]}
  />
);
