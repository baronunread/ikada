/**
 * Installs the packed tarball into a fresh app and builds it, the way a consumer would:
 *
 *   bun scripts/test-tarball.ts next   a Next.js App Router app whose page is a Server Component
 *   bun scripts/test-tarball.ts vite   a Vite + Tailwind app
 *
 * The fixture lives in fixtures/<name>; it is copied to a temp dir, never built in place.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const which = process.argv[2];
if (which !== "next" && which !== "vite") {
  console.error("usage: bun scripts/test-tarball.ts <next|vite>");
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), `ikada-${which}-`));
const run = (cmd: string, args: string[], cwd: string): void => {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  if (r.status !== 0) {
    console.error(`failed: ${cmd} ${args.join(" ")} (kept ${work})`);
    process.exit(r.status ?? 1);
  }
};

try {
  const packDir = join(work, "pack");
  run("mkdir", ["-p", packDir], root);
  run("npm", ["pack", "--pack-destination", packDir, "--silent"], root);
  const tarball = join(packDir, readdirSync(packDir).find((f) => f.endsWith(".tgz")) ?? "");
  const app = join(work, "app");
  cpSync(join(root, "fixtures", which), app, { recursive: true });
  const pkgPath = join(app, "package.json");
  writeFileSync(pkgPath, readFileSync(pkgPath, "utf8").replace("TARBALL", `file:${tarball}`));
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], app);
  if (which === "next") run("npx", ["tsc", "--noEmit"], app);
  run("npm", ["run", "build"], app);
  console.log(`ok: ${which} fixture built from the packed tarball`);
} finally {
  if (!process.env.KEEP_FIXTURE) rmSync(work, { recursive: true, force: true });
}
