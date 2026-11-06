import { Link } from "../../../src/components/link";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <div className="flex flex-col items-center gap-1">
    <Link href="#docs">Read the docs</Link>
    <Link href="https://sproutboat.com" external>
      sproutboat.com
    </Link>
  </div>
);
