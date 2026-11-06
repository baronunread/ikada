/**
 * Crawls the built site through a running preview and fails on any internal link that 404s, any
 * `#fragment` that names no element on its page, and any dead placeholder (`href="#"`, empty href,
 * `javascript:`). Links inside a live demo (`[data-demo]`: a breadcrumb trail, a project list) must
 * point at a real page of the site like any other link; an in-page `#fragment` there is a no-op
 * click and fails. Demos that render only in the browser (`client:only`, the block pages) are read
 * from a real Chromium. External links are listed, not fetched.
 *   PORT=4410 bun scripts/check-links.ts
 */
const origin = `http://localhost:${process.env.PORT ?? 4410}`;
const start = "/ikada/";

const seen = new Map<string, string>(); // path → html
const problems: string[] = [];
const external = new Set<string>();
const queue: { path: string; from: string }[] = [{ path: start, from: "(start)" }];

const ids = (html: string): Set<string> => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ""));
/** Every <a href> outside <template>, flagged when it sits inside a [data-demo] element. */
function hrefs(html: string): { href: string; demo: boolean }[] {
  const out: { href: string; demo: boolean }[] = [];
  let demo = 0;
  let template = 0;
  new HTMLRewriter()
    .on("[data-demo]", {
      element(el) {
        demo++;
        el.onEndTag(() => void demo--);
      },
    })
    .on("template", {
      element(el) {
        template++;
        el.onEndTag(() => void template--);
      },
    })
    .on("a[href]", {
      element(el) {
        if (!template) out.push({ href: el.getAttribute("href") ?? "", demo: demo > 0 });
      },
    })
    .transform(html);
  return out;
}
// Demos that render only in the browser (client:only) are not in the HTML: read them from Chromium.
type Browser = import("@playwright/test").Browser;
let browser: Browser | undefined;
async function browserDemoHrefs(path: string): Promise<string[]> {
  const { chromium } = await import("@playwright/test");
  browser ??= await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(origin + path, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-block-ready]", { timeout: 15_000 }).catch(() => {});
    return await page.$$eval("[data-demo] a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
  } finally {
    await page.close();
  }
}

let demoLinks = 0;

let links = 0;
const pending: { url: URL; from: string }[] = [];

while (queue.length) {
  const { path, from } = queue.shift()!;
  if (seen.has(path)) continue;
  const res = await fetch(origin + path, { redirect: "follow" });
  if (res.status !== 200) {
    problems.push(`${res.status} ${path} (linked from ${from})`);
    seen.set(path, "");
    continue;
  }
  const html = await res.text();
  seen.set(path, html);
  if (
    !(res.headers.get("content-type") ?? "").includes("html") &&
    !path.endsWith(".html") &&
    !html.trimStart().startsWith("<!")
  )
    continue;
  const found = hrefs(html);
  if (html.includes('client="only"'))
    for (const raw of await browserDemoHrefs(path)) found.push({ href: raw, demo: true });
  for (const { href: raw, demo } of found) {
    links++;
    if (demo) demoLinks++;
    if (demo && raw.startsWith("#")) {
      problems.push(`no-op in-page demo anchor href="${raw}" on ${path}`);
      continue;
    }
    if (raw === "" || raw === "#" || raw.startsWith("javascript:")) {
      problems.push(`dead placeholder href="${raw}" on ${path}`);
      continue;
    }
    const url = new URL(raw, origin + path);
    if (url.origin !== origin) {
      external.add(url.href);
      continue;
    }
    if (!url.pathname.startsWith("/ikada")) {
      problems.push(`outside the /ikada base: ${raw} on ${path}`);
      continue;
    }
    if (demo && url.pathname === new URL(origin + path).pathname && url.hash) {
      problems.push(`no-op in-page demo anchor href="${raw}" on ${path}`);
      continue;
    }
    pending.push({ url, from: path });
    if (!seen.has(url.pathname)) queue.push({ path: url.pathname, from: path });
  }
}

await browser?.close();

for (const { url, from } of pending) {
  if (!url.hash) continue;
  const html = seen.get(url.pathname);
  if (!html) continue;
  const id = decodeURIComponent(url.hash.slice(1));
  if (!ids(html).has(id)) problems.push(`missing #${id} on ${url.pathname} (linked from ${from})`);
}

console.log(
  `${seen.size} pages, ${links} links checked, ${demoLinks} sample links inside live demos (all real pages), ${external.size} external links (not fetched):`,
);
for (const e of [...external].sort()) console.log(`  ${e}`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of [...new Set(problems)]) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nNo 404s, no missing anchors, no dead placeholders, no no-op demo anchors.");

export {};
