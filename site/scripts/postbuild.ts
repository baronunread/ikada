/**
 * After `astro build`:
 *  - the asset server looks for /404.html at the root of the assets directory;
 *  - every docs page gets a `.md` twin (the same markdown "Copy page for AI" copies, taken from
 *    the page's <template id="page-md">) and an `<link rel="alternate" type="text/markdown">`;
 *  - /ikada/llms.txt (the llmstxt.org index), /ikada/llms-full.txt (every page's markdown),
 *    /ikada/sitemap.xml and /ikada/robots.txt.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = join(import.meta.dir, "../dist");
const out = join(dist, "ikada");
const ORIGIN = "https://sproutboat.com";
const BASE = `${ORIGIN}/ikada`;

copyFileSync(join(out, "404.html"), join(dist, "404.html"));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");

interface Page {
  /** "components/button" or "" for the home page. */
  path: string;
  title: string;
  description: string;
  markdown: string | null;
}

const pages: Page[] = [];
for (const file of walk(out).filter((f) => f.endsWith(".html") && !f.endsWith("404.html"))) {
  let html = readFileSync(file, "utf8");
  const path = relative(out, file)
    .replace(/\.html$/, "")
    .replace(/^index$/, "");
  const title = unescape(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? path);
  const description = unescape(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "");
  const md = /<template id="page-md">([\s\S]*?)<\/template>/.exec(html)?.[1];
  const markdown = md ? unescape(md) : null;
  if (markdown) {
    writeFileSync(file.replace(/\.html$/, ".md"), `${markdown}\n`);
    if (!html.includes('type="text/markdown"')) {
      html = html.replace("</head>", `<link rel="alternate" type="text/markdown" href="${BASE}/${path}.md"></head>`);
      writeFileSync(file, html);
    }
  }
  pages.push({ path, title, description, markdown });
}
pages.sort((a, b) => a.path.localeCompare(b.path));

const url = (p: string, ext = ""): string => `${BASE}/${p}${ext}`.replace(/\/$/, "/");
const line = (p: Page): string =>
  `- [${p.title.replace(/ [|·—-] ikada.*$/i, "")}](${url(p.path, ".md")})${p.description ? `: ${p.description}` : ""}`;
const group = (prefix: string): Page[] => pages.filter((p) => p.markdown && p.path.startsWith(prefix));
const top = pages.filter((p) => p.markdown && !p.path.includes("/") && p.path !== "blocks");

const llms = [
  "# ikada",
  "",
  "> ikada is the Sproutboat design system: React components on Base UI and Tailwind CSS v4, OKLCH tokens (light by default, dark with a `.dark` class), 42 components and 11 dashboard blocks. Install from the shadcn registry (`@ikada/<name>`, files land in `components/ikada/`, never over your own shadcn files) or from npm (`@sproutboat/ikada`, compiled ESM with types).",
  "",
  "## Docs",
  ...top.map(line),
  "",
  "## Components",
  ...group("components/").map(line),
  "",
  "## Blocks",
  ...group("blocks/").map(line),
  "",
  "## Registry",
  `- [registry.json](${BASE}/r/registry.json): the shadcn registry index; each item is ${BASE}/r/<name>.json`,
  `- Add to components.json: "registries": { "@ikada": "${BASE}/r/{name}.json" }, then \`npx shadcn@latest add @ikada/button\``,
  "",
  "## Optional",
  `- [Everything in one file](${BASE}/llms-full.txt): the markdown of every page above`,
  "- [npm package](https://www.npmjs.com/package/@sproutboat/ikada)",
  "- [Source on GitHub](https://github.com/baronunread/ikada)",
  "",
].join("\n");
writeFileSync(join(out, "llms.txt"), llms);

const full = pages
  .filter((p) => p.markdown)
  .map((p) => p.markdown)
  .join("\n\n---\n\n");
writeFileSync(join(out, "llms-full.txt"), `# ikada: full documentation\n\n${full}\n`);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((p) => `  <url><loc>${url(p.path)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
writeFileSync(join(out, "sitemap.xml"), sitemap);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

if (!existsSync(join(out, "llms.txt"))) throw new Error("llms.txt was not written");
console.log(
  `postbuild: ${pages.length} pages, ${pages.filter((p) => p.markdown).length} markdown twins, llms.txt, llms-full.txt, sitemap.xml, robots.txt`,
);
