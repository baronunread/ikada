import { DescriptionList } from "../../../src/components/description-list";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <DescriptionList
    className="w-60 [zoom:0.85]"
    items={[
      { id: "region", term: "Region", details: "Frankfurt" },
      { id: "runtime", term: "Runtime", details: "Node 24" },
    ]}
  />
);
