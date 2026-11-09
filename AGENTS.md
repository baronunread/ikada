# AGENTS.md

`@sproutboat/ikada` (筏, raft): the Sproutboat design system. TypeScript source only, no build step. Consumed by the Community dashboard (baronunread/sproutboat, `apps/web`) and the Cloud dashboard.

## Commands

Bun is the package manager (`bun.lock` is committed; CI uses `--frozen-lockfile`).

- `bun run check`: `tokens:check`, `typecheck` and `test`. Run it before every commit.
- `bun run fmt` / `fmt:check`: oxfmt, 120 columns. CI gates on `fmt:check`.
- `bun run playground`: gallery and dashboard sandbox at :5180.
- `bun run e2e`: Playwright against the playground at 390px and 1440px, light and dark.
- `bun run site` / `site:build`: the docs site and shadcn registry in `site/` (see site/README.md). The registry is generated from `src/` by `scripts/build-registry.ts`; never edit registry JSON by hand.
- `bun run tokens`: regenerate `src/theme.css`, `src/tokens.generated.ts` and the DESIGN.md token tables from `tokens/tokens.ts`.

## Rules

- Never hand-edit generated files (`src/theme.css`, `src/tokens.generated.ts`, the marked regions in DESIGN.md). Change `tokens/tokens.ts` (and `tokens/pairs.ts` for text/UI colours), then run `bun run tokens`. Contrast and drift tests must pass.
- DESIGN.md is the contract (principles, tokens, usage rules); INVENTORY.md lists every component and its status. Update both when a component or token changes.
- Every component gets a playground entry and a test in `test/` (the a11y suite runs axe on them).
- The package is open source: keep Cloud-only or product-specific UI out of it.
- Light is the default theme, dark is a `dark` class on `<html>` (`data-theme` is a deprecated alias); the `dark:` variant follows the class. Components use `text-sb-*` sizes, not `text-sm`.
- Check UI changes at 390px and 1440px in both themes, including open states, focus and hover. `bun run e2e` covers overflow; look at the result anyway.

## Releases

Tag `v<version>` on `main` after bumping `package.json`. `.github/workflows/publish.yml` publishes to npm over Trusted Publishing (OIDC, provenance). No tokens, no local `npm publish`. The trusted-publisher config is the `fledgling` block in `package.json`; apply it with `npx fledgling sync`.
