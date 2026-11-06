import { Avatar } from "../../../src/components/avatar";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-2">
    <Avatar name="mika" size="sm" />
    <Avatar name="andrea" />
    <Avatar name="rowan" size="lg" />
  </div>
);
