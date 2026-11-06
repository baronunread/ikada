/**
 * Crawls the built site through a running preview and fails on any internal link that 404s, any
 * `#fragment` that names no element on its page, and any dead placeholder (`href="#"`, empty href,
 * `javascript:`). Links inside a live demo (`[data-demo]`: a breadcrumb trail, a project list) are
 * sample data pointing at in-app fragments; they are counted and listed, and the page holds their
 * clicks (lib/chrome.ts), but a bare "#" fails there too. External links are listed, not fetched.
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
const demoLinks = new Set<string>();

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
  for (const { href: raw, demo } of hrefs(html)) {
    links++;
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
      demoLinks.add(`${raw} on ${path}`);
      continue;
    }
    pending.push({ url, from: path });
    if (!seen.has(url.pathname)) queue.push({ path: url.pathname, from: path });
  }
}

for (const { url, from } of pending) {
  if (!url.hash) continue;
  const html = seen.get(url.pathname);
  if (!html) continue;
  const id = decodeURIComponent(url.hash.slice(1));
  if (!ids(html).has(id)) problems.push(`missing #${id} on ${url.pathname} (linked from ${from})`);
}

console.log(
  `${seen.size} pages, ${links} links checked, ${demoLinks.size} sample links inside live demos (clicks held), ${external.size} external links (not fetched):`,
);
for (const e of [...external].sort()) console.log(`  ${e}`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of [...new Set(problems)]) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nNo 404s, no missing anchors, no dead placeholders.");

export {};
