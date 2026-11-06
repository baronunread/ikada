import { StatusDot } from "../../../src/components/status-dot";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col gap-1.5">
    <StatusDot status="success" label="Live" />
    <StatusDot status="warning" label="DNS pending" />
    <StatusDot status="danger" label="Build failed" />
  </div>
);
