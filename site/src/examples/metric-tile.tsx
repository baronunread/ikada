import { Sparkline } from "../../../src/charts/sparkline";
import { MetricTile } from "../../../src/components/metric-tile";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <MetricTile
    label="Requests"
    value="1.28M"
    delta={{ value: "12%", direction: "up" }}
    sparkline={
      <Sparkline ariaLabel="Requests, last 24 hours" height={28} data={[8, 11, 9, 14, 13, 17, 16, 21, 19, 24]} />
    }
    className="w-52 [zoom:0.8]"
  />
);
