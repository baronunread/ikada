# ikada site

The docs, playground and shadcn registry at [sproutboat.com/ikada](https://sproutboat.com/ikada). An Astro static
build with React islands for the live examples. Everything is generated from this repo's `src/` at build time:
the component list, the props tables, the theming tables and the registry. Nothing here keeps its own copy.

```sh
bun install                 # at the repo root (the site is a workspace)
cd site
bun run dev                 # astro dev on 0.0.0.0:4321, under /ikada
bun run build               # registry + pages -> dist/ikada
bun run preview             # serve dist/ like the asset server, 0.0.0.0:4410
```

## Layout

- `scripts/registry.ts`: runs `../scripts/build-registry.ts` into `.registry/`, then `shadcn build` into `public/r`,
  which Astro copies to `/ikada/r/<name>.json`. Set `IKADA_REGISTRY_URL` to a preview's address when testing
  `npx shadcn add` against it (dependencies between items are absolute URLs).
- `src/lib/registry.ts`: the item list the pages are built from. A page exists for every ui file that exports a
  React component. `src/lib/site.ts`: the navigation, page order, gzipped sizes, the install command for each
  package manager and the "Copy page for AI" markdown.
- `src/lib/props.ts`: props tables from each exported `…Props` interface (own members and JSDoc; inherited props are
  named by the `extends` clause).
- `src/layouts/Shell.astro` (head, header, mobile drawer, footer) and `Docs.astro` (sidebar, prose, "On this page").
  `src/lib/chrome.ts` is the chrome's only script: theme, copy buttons, drawer, TOC, segmented radios with roving
  tabindex, install tabs, block stages, and search (ikada's CommandPalette, loaded on the first ⌘K or click).
- `src/pages/components/[slug].astro`: the component page: the stage (the prop playground, else the first example),
  install tabs, usage, examples (each with Preview / Code, a scoped theme switch and copy), props, pager.
- `src/examples/<slug>.tsx`: `examples: Example[]` (each with the `code` a reader would write), an optional
  `playground: Playground` (the props it edits and how it renders; `examples/types.ts` is the contract) and
  `preview: Preview` for the homepage tiles. Each file is its own chunk, loaded only where it is used. Examples render
  on the server and hydrate, so keep them free of `window` and `document` at render time. Sample links in a demo
  point at in-app fragments (`#logs`), never a bare `#`; `[data-demo]` areas hold those clicks so the page stays put.
- `src/pages/blocks/[slug].astro`: one page per block (`../blocks/<name>/`): the live block with its sample data
  (`components/BlockPreview.tsx`, client-only) at full, 768 or 390 px, its code (read from `.registry`, so it shows
  the rewritten `@/components/ui/*` imports), install tabs, the components it is built from and its props. A block
  folder added while `astro dev` runs is not seen by `import.meta.glob` until the dev server restarts.
- `src/hero-field/`: the homepage field (Growth). `common.ts`, `hero-webgpu.ts`, `hero-webgl.ts`, `palette.ts` and
  `mask.ts` are the shader's own files, copied verbatim from where it is designed with
  `bun scripts/sync-hero-field.ts <the shader's src/>`. `load.ts` picks WebGPU (TypeGPU) → WebGL2 → the CSS gradient;
  `hero.ts` loads it after `load` in idle time and feeds it the text mask, the grow-in and planting. `?backend=webgl2`
  or `?backend=css` forces a fallback.
- `scripts/check-links.ts`: crawls a running preview (`bun run preview`, then `bun scripts/check-links.ts`) and fails
  on any 404, missing `#anchor` or bare `href="#"`.

## Deploying

The site is its own Sproutboat app, `ikada-site` (`sproutboat.jsonc`, `src/sprout.js`). Its build sits under
`dist/ikada`, so the files have the same paths they are served from. sproutboat.com reaches it over a service
binding: the sproutboat.com sprout sends `/ikada` and `/ikada/*` to `env.IKADA.fetch(request)`.

```sh
bun run deploy              # build + bunx sproutboat deploy, from site/
```

Why a separate app and a binding instead of copying the build into sproutboat-site: ikada's docs then ship with
ikada. A release, a new component or a registry change deploys from this repo alone, and sproutboat.com changed once
(the binding and one route) and never rebuilds for it. Copying the build into sproutboat-site would make every docs
update a sproutboat.com deploy and make that build fetch and build a second repo.

Deploy order the first time: `ikada-site` first, then sproutboat.com with the binding. A binding to a project that
is not deployed returns an error, but only for `/ikada` paths.
