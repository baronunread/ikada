import { Field } from "../../../src/components/field";
import { Input } from "../../../src/components/input";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Field label="Project name" description="Lowercase and dashes." className="w-60">
    <Input defaultValue="my-app" />
  </Field>
);
