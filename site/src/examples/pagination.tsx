import { Pagination } from "../../../src/components/pagination";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <Pagination compact page={3} pageCount={12} onPageChange={() => {}} />;
