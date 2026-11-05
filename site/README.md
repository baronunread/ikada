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
  React component.
- `src/lib/props.ts`: props tables from each exported `…Props` interface (own members and JSDoc; inherited props are
  named by the `extends` clause).
- `src/pages/components/[slug].astro`: the component page template: examples, install commands, props, source link.
- `src/examples/<slug>.tsx`: live examples for one component, `export const examples: Example[]`. A component with
  no file shows a placeholder. Each file is its own chunk, loaded only on its page.

## Deploying

The site is its own Sproutboat app, `ikada-site` (`sproutboat.jsonc`, `sprout/index.js`). Its build sits under
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
