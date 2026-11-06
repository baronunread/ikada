import { EmptyState } from "../../../src/components/empty-state";
import { InboxIcon } from "../../../src/lib/icons";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <EmptyState icon={<InboxIcon />} title="No deploys yet" className="py-0" />;
