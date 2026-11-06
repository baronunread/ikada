import { Input } from "../../../src/components/input";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <Input aria-label="Domain" placeholder="docs.example.com" className="w-60" />;
