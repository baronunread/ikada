// bun build.ts [outdir] — bundles page.ts (the mock page + the dusk module) with unplugin-typegpu.
// typegpu + unplugin-typegpu resolve from a scratch install (TYPEGPU_DIR, default /tmp/typegpu-scratch).
const SCRATCH = process.env.TYPEGPU_DIR ?? '/tmp/typegpu-scratch';
const here = (f: string) => new URL(f, import.meta.url).pathname;
const out = process.argv[2] ?? '/Users/andreabruno/Code/Products/sproutboat-platform/mockups-20261104/dusk-ship';
const typegpu = (await import(Bun.resolveSync('unplugin-typegpu/bun', SCRATCH))).default;
const scratch: import('bun').BunPlugin = { name: 'scratch', setup(b) { b.onResolve({ filter: /^typegpu(\/.*)?$/ }, (a) => ({ path: Bun.resolveSync(a.path, SCRATCH) })); } };
const r = await Bun.build({
  entrypoints: [here('page.ts')], outdir: out, naming: { entry: '[name].js' },
  target: 'browser', format: 'esm', minify: false, plugins: [typegpu(), scratch],
});
if (!r.success) { for (const l of r.logs) console.error(String(l)); process.exit(1); }
await Bun.write(`${out}/index.html`, Bun.file(here('index.html')));
for (const o of r.outputs) console.log(o.path.split('/').pop(), (o.size / 1024).toFixed(1) + ' KB');
