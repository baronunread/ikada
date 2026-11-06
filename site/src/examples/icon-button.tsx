import { IconButton } from "../../../src/components/icon-button";
import { CopyIcon, MoreIcon, RefreshIcon } from "../../../src/lib/icons";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex gap-1">
    <IconButton label="Copy">
      <CopyIcon />
    </IconButton>
    <IconButton label="Refresh" variant="secondary">
      <RefreshIcon />
    </IconButton>
    <IconButton label="More">
      <MoreIcon />
    </IconButton>
  </div>
);
