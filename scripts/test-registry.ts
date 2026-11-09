/**
 * Installs EVERY registry item into a stock shadcn project and builds it:
 *
 *   bun scripts/test-registry.ts next   a Next.js App Router project (aliases @/)
 *   bun scripts/test-registry.ts vite   a Vite project with a custom alias (~/ over src/)
 *
 * 1. builds the registry with `shadcn build` and serves it on a local port,
 * 2. copies fixtures/shadcn-<name> (it already holds stock shadcn button, input, dialog, select,
 *    tabs, sidebar, toast... and lib/utils.ts), and hashes those files,
 * 3. `shadcn add` of every item, the first by URL and the rest as `@ikada/<name>`, with -y and
 *    without -o: a collision would stop on the overwrite prompt,
 * 4. checks every stock file is byte for byte unchanged and every ikada file landed under
 *    components/ikada/, then runs tsc and the build with all of them imported.
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const which = process.argv[2];
if (which !== "next" && which !== "vite") {
  console.error("usage: bun scripts/test-registry.ts <next|vite>");
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), `ikada-registry-${which}-`));
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg} (kept ${work})`);
  process.exit(1);
};
const run = async (cmd: string, args: string[], cwd: string, quiet = false): Promise<void> => {
  console.log(`$ ${cmd} ${args.slice(0, 6).join(" ")}${args.length > 6 ? ` ... (${args.length} args)` : ""}`);
  // Async, not spawnSync: the registry server below lives in this process and must keep answering.
  const proc = Bun.spawn([cmd, ...args], {
    cwd,
    stdin: "ignore",
    stdout: quiet ? "ignore" : "inherit",
    stderr: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" },
  });
  const code = await proc.exited;
  if (code !== 0) fail(`${cmd} ${args[0] ?? ""} exited ${code}`);
};
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return f === "node_modules" || f === ".next" ? [] : statSync(p).isDirectory() ? walk(p) : [p];
  });
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

const port = 4600 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}/r`;
let server: ReturnType<typeof Bun.serve> | undefined;

try {
  // 1. the registry, as the site builds it
  const reg = join(work, "registry");
  mkdirSync(reg, { recursive: true });
  await run("bun", [join(root, "scripts/build-registry.ts"), "--out", reg, "--url", base], root, true);
  const out = join(work, "r");
  await run("bunx", ["shadcn", "build", "registry.json", "--output", out], reg, true);
  server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
      const name = new URL(req.url).pathname.replace(/^\/r\//, "");
      const f = Bun.file(join(out, name));
      return new Response(f, { headers: { "content-type": "application/json" } });
    },
  });

  // 2. a stock shadcn project
  const app = join(work, "app");
  cpSync(join(root, "fixtures", `shadcn-${which}`), app, { recursive: true });
  const cj = join(app, "components.json");
  writeFileSync(cj, readFileSync(cj, "utf8").replace("REGISTRY", base));
  await run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], app, true);
  const stock = new Map(
    walk(app)
      .filter((p) => /components\/ui\/|lib\/utils\.ts$/.test(p))
      .map((p) => [relative(app, p), sha(p)]),
  );
  const before = new Set(walk(app));
  if (stock.size < 10) fail(`expected the stock shadcn files in the fixture, found ${stock.size}`);

  // 3. every item
  const index = JSON.parse(readFileSync(join(out, "registry.json"), "utf8")) as { items: { name: string }[] };
  const names = index.items.map((i) => i.name);
  const specs = names.map((n, i) => (i === 0 ? `${base}/${n}.json` : `@ikada/${n}`));
  await run("npx", ["shadcn", "add", ...specs, "--yes", "--cwd", app], app);

  // 4. no collisions, everything under components/ikada
  const dirOf = (p: string): string => (which === "next" ? join(app, p) : join(app, "src", p));
  const stockLost = [...stock].filter(([p, h]) => !existsSync(join(app, p)) || sha(join(app, p)) !== h).map(([p]) => p);
  if (stockLost.length) fail(`stock files were overwritten: ${stockLost.join(", ")}`);
  const ikadaDir = dirOf("components/ikada");
  if (!existsSync(ikadaDir)) fail(`nothing was installed to ${ikadaDir}`);
  const installed = walk(ikadaDir).filter((p) => /\.tsx?$/.test(p));
  console.log(`installed ${installed.length} files under components/ikada for ${names.length} items`);
  const created = walk(app).filter(
    (p) => !before.has(p) && !p.includes("components/ikada") && !p.endsWith("package-lock.json"),
  );
  const unexpected = created.map((p) => relative(app, p)).filter((p) => !p.endsWith(".d.ts"));
  if (unexpected.length) fail(`files created outside components/ikada: ${unexpected.join(", ")}`);

  // 5. typecheck and build with all of it imported
  if (which === "next") {
    const mods = installed.map((p, i) => `import * as m${i} from "@/${relative(app, p).replace(/\.tsx?$/, "")}";`);
    writeFileSync(
      join(app, "app/all.tsx"),
      `"use client";\n${mods.join("\n")}\nexport const all = [${installed.map((_, i) => `m${i}`).join(", ")}];\nexport function All() {\n  return <>{all.length}</>;\n}\n`,
    );
    writeFileSync(
      join(app, "app/page.tsx"),
      `import { All } from "./all";\nimport { Button } from "@/components/ui/button";\n\nexport default function Page() {\n  return (\n    <>\n      <Button />\n      <All />\n    </>\n  );\n}\n`,
    );
    await run("npx", ["tsc", "--noEmit"], app);
  } else {
    writeFileSync(
      join(app, "src/main.tsx"),
      `import { createRoot } from "react-dom/client";\nimport { Button } from "~/components/ui/button";\nimport "./index.css";\n\nconst all = import.meta.glob("./components/ikada/**/*.tsx", { eager: true });\nconsole.log(Object.keys(all).length);\ncreateRoot(document.getElementById("root")!).render(<Button />);\n`,
    );
  }
  await run("npm", ["run", "build"], app);
  console.log(
    `ok: ${names.length} items installed into a stock shadcn ${which} project, no collisions, tsc and build pass`,
  );
} finally {
  server?.stop(true);
  if (!process.env.KEEP_FIXTURE) rmSync(work, { recursive: true, force: true });
}
