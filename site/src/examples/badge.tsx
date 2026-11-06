import { Badge } from "../../../src/components/badge";
import type { Preview } from "./types";

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
