"use client";
import { TimeseriesChart } from "@sproutboat/ikada/charts";

export function Chart() {
  return (
    <TimeseriesChart
      ariaLabel="Requests"
      series={[
        {
          id: "r",
          label: "Requests",
          data: [
            { time: 0, value: 1 },
            { time: 1, value: 2 },
          ],
        },
      ]}
    />
  );
}
