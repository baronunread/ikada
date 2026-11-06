import { CodeBlock } from "../../../src/components/code-block";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <CodeBlock className="w-60" label="Deploy" code="sproutboat deploy" />;
