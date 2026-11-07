// bun serve.ts [dir] [port] — static server bound to 0.0.0.0
const dir = process.argv[2] ?? '/Users/andreabruno/Code/Products/sproutboat-platform/mockups-20261104/dusk-ship';
const port = Number(process.argv[3] ?? 4466);
Bun.serve({
  hostname: '0.0.0.0', port,
  async fetch(req) {
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = Bun.file(dir + p);
    return (await f.exists()) ? new Response(f, { headers: { 'cache-control': 'no-store' } }) : new Response('not found', { status: 404 });
  },
});
console.log(`serving ${dir} on 0.0.0.0:${port}`);
