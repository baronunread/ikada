/** The asset server looks for /404.html at the root of the assets directory. */
import { copyFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "../dist");
copyFileSync(join(dist, "ikada/404.html"), join(dist, "404.html"));
