# @sproutboat/ikada

筏 ikada (raft) is the Sproutboat design system: design tokens and React components built on [Base UI](https://base-ui.com) and Tailwind CSS v4. It is what the Sproutboat dashboards are made of.

```sh
bun add @sproutboat/ikada
# peers: react, react-dom, tailwindcss
```

```css
/* your app.css */
@import "tailwindcss";
@import "@sproutboat/ikada/theme.css";
/* Tailwind does not scan node_modules: point it at the package source */
@source "../node_modules/@sproutboat/ikada/src";
```

```tsx
import { Button } from "@sproutboat/ikada";
import { Sparkline } from "@sproutboat/ikada/charts";
import { colors, typeScale } from "@sproutboat/ikada/tokens";
```

| Export                        | Contents                                        |
| ----------------------------- | ----------------------------------------------- |
| `@sproutboat/ikada`           | Components, hooks and formatting helpers        |
| `@sproutboat/ikada/theme.css` | Tailwind v4 theme: colour, type, radius, motion |
| `@sproutboat/ikada/tokens`    | The same tokens as a typed TypeScript object    |
| `@sproutboat/ikada/charts`    | `Sparkline` and `TimeseriesChart`               |

The package ships TypeScript source, not a compiled build: use it from a bundler that compiles TypeScript in `node_modules` (Vite, Bun, or Next.js with `transpilePackages`).

See [DESIGN.md](DESIGN.md) for the principles and [INVENTORY.md](INVENTORY.md) for every component and its status.

## Develop

```sh
bun install
bun run playground      # every component, at http://localhost:5180 (bound to 0.0.0.0)
bun run check           # tokens:check, typecheck, tests
bun run e2e             # screenshot and overflow checks of the playground (needs Chromium)
bun run tokens          # regenerate theme.css, tokens.generated.ts and the DESIGN.md tables
```

Tokens live in `tokens/tokens.ts`; never edit the generated files.

## Release

Bump `version` in `package.json` on `main`, then tag and push:

```sh
git tag -a v0.2.0 -m v0.2.0 && git push origin v0.2.0
```

The `publish` workflow checks that the tag matches the version, runs the checks and publishes to npm with provenance over Trusted Publishing (OIDC, no token). The trusted-publisher settings are the `fledgling` block in `package.json`.

The package began as `packages/ikada` in [baronunread/sproutboat](https://github.com/baronunread/sproutboat); its history was carried over.

Docs, live examples and a shadcn registry live at [sproutboat.com/ikada](https://sproutboat.com/ikada) (source in [`site/`](site/README.md)):

```sh
npx shadcn@latest add https://sproutboat.com/ikada/r/button.json
```

Blocks are copyable dashboard patterns built from the components, each with realistic sample data: a project tray,
usage line, KV browser, D1 console, metrics, traffic chart, logs panel, empty states, toasts with undo, a settings
section and a sign-in card. They live in [`blocks/`](blocks/) (`blocks/<name>/<name>.tsx` exports a component that
renders with no props) and install the same way:

```sh
npx shadcn@latest add https://sproutboat.com/ikada/r/kv-browser.json
```

MIT licensed.
