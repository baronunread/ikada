import { Breadcrumbs } from "../../../src/components/breadcrumbs";
import type { Preview } from "./types";

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Breadcrumbs items={[{ label: "acme", href: "#acme" }, { label: "web", href: "#web" }, { label: "Logs" }]} />
);
