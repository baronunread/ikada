import { Input } from "../../../src/components/input";
import { Label } from "../../../src/components/label";
import type { Example, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "Label",
    description: "Pair it with a control through htmlFor and id. Inside a Field this is wired for you.",
    render: () => (
      <div className="flex w-full max-w-72 flex-col gap-1.5">
        <Label htmlFor="label-sprout">Sprout name</Label>
        <Input id="label-sprout" defaultValue="robin" />
      </div>
    ),
    code: `<div className="flex flex-col gap-1.5">
  <Label htmlFor="sprout">Sprout name</Label>
  <Input id="sprout" defaultValue="robin" />
</div>`,
  },
  {
    title: "Required",
    description: "The asterisk is for sighted users; the control still needs required itself.",
    render: () => (
      <div className="flex w-full max-w-72 flex-col gap-1.5">
        <Label htmlFor="label-domain" required>
          Domain
        </Label>
        <Input id="label-domain" required placeholder="robin.sproutboat.app" />
      </div>
    ),
    code: `<div className="flex flex-col gap-1.5">
  <Label htmlFor="domain" required>
    Domain
  </Label>
  <Input id="domain" required placeholder="robin.sproutboat.app" />
</div>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <Label required>Project name</Label>;
