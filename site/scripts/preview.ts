/**
 * Serves dist/ the way the Sproutboat asset server does: /x tries x, x.html, x/index.html,
 * then 404.html. Binds 0.0.0.0 so a phone or another machine on the LAN can open it.
 *   PORT=4410 bun scripts/preview.ts
 */
import { join, normalize } from "node:path";

const dist = join(import.meta.dir, "../dist");
const port = Number(process.env.PORT ?? 4410);

async function file(path: string): Promise<Response | null> {
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [safe, `${safe}.html`, join(safe, "index.html")]) {
    const f = Bun.file(join(dist, candidate));
    if (!candidate.endsWith("/") && (await f.exists())) return new Response(f);
  }
  return null;
}

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/" || pathname === "/ikada") return Response.redirect("/ikada/", 302);
    const hit = await file(decodeURIComponent(pathname));
    if (hit) return hit;
    return new Response(Bun.file(join(dist, "404.html")), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  },
});
console.log(`ikada site on http://0.0.0.0:${port}/ikada/`);
