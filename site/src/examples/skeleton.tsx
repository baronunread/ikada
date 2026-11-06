import { Skeleton } from "../../../src/components/skeleton";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex w-56 flex-col gap-2">
    <Skeleton className="w-3/4" />
    <Skeleton />
    <Skeleton className="w-1/2" />
  </div>
);
