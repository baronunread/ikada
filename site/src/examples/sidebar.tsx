import { FolderIcon, HomeIcon, LogsIcon } from "../../../src/lib/icons";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-44 flex-col gap-0.5 rounded-xl bg-surface p-2 text-sm shadow-card">
    <span className="flex items-center gap-2 rounded-md bg-hover px-2 py-1.5 font-semibold">
      <HomeIcon /> Home
    </span>
    <span className="flex items-center gap-2 px-2 py-1.5 text-fg-muted">
      <FolderIcon /> Projects
    </span>
    <span className="flex items-center gap-2 px-2 py-1.5 text-fg-muted">
      <LogsIcon /> Logs
    </span>
  </div>
);
