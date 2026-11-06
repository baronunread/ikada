import { StatusGlyph } from "../../../src/components/status-glyph";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex items-center gap-3">
    <StatusGlyph status="success" />
    <StatusGlyph status="warning" />
    <StatusGlyph status="danger" />
    <StatusGlyph status="info" />
    <StatusGlyph status="neutral" />
  </div>
);
