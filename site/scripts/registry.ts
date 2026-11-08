/**
 * Builds the shadcn registry from ikada's own source into public/r, which Astro copies to
 * /ikada/r. Every run regenerates it; nothing under public/r is committed.
 *
 * IKADA_REGISTRY_URL is the public base of /r, used in each item's registryDependencies.
 * It defaults to production; a local preview sets it to the LAN address so the CLI resolves
 * dependencies against the preview too.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const site = join(import.meta.dir, "..");
const url = process.env.IKADA_REGISTRY_URL ?? "https://sproutboat.com/ikada/r";
const run = (cmd: string, args: string[], cwd: string): void => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

run("bun", [join(site, "../scripts/build-registry.ts"), "--out", join(site, ".registry"), "--url", url], site);
rmSync(join(site, "public/r"), { recursive: true, force: true });
run("bunx", ["shadcn", "build", "registry.json", "--output", join(site, "public/r")], join(site, ".registry"));
