# Changelog

## 0.2.0

The package is now a compiled build, works from Server Components, and follows the standard dark mode. 0.1.0 shipped raw TypeScript and was only usable from bundlers that compile `node_modules`.

### Added

- **Compiled ESM in `dist/`**: one JavaScript file per source module (so bundlers tree-shake per component), `.d.ts` files with declaration maps, and source maps. `exports` lists `types` first. Node, Next.js, Vite, Remix, Astro and Jest resolve it without `transpilePackages` or any config.
- **A subpath per component**: `import { Button } from "@sproutboat/ikada/button"`, next to the barrel (`@sproutboat/ikada`), `/charts`, `/tokens`, `/theme.css` and `/package.json`.
- **`"use client"` on every client module**, kept in the built files and checked in CI. A Server Component can render `Button`, `CopyId`, `Tabs`, `Table` and the rest (pass only serializable props; callbacks need a client file of your own).
- **`@source` in `theme.css`**: `@import "@sproutboat/ikada/theme.css"` now tells Tailwind v4 to scan the compiled components, so the README's manual `@source` line is no longer needed.
- CI gates: `publint --strict`, `attw --pack`, size budgets per entry (`size-limit`), and a packed-tarball install into a fresh Next.js App Router app (Server Component page plus `next build`) and a fresh Vite app.

### Changed

- **Dark mode is the standard now.** Light is the default; dark is a `dark` class on `<html>` (shadcn and next-themes `attribute="class"`). The `dark:` Tailwind variant follows the class. `data-theme="dark"` and `data-theme="light"` still work as a deprecated alias for one release (they will be removed in 0.3.0). The shadcn registry theme already used `.dark`, so both install paths now behave the same.
- **A type scale of its own.** Components use `text-sb-xs` to `text-sb-metric` instead of `text-xs` to `text-metric`, so installing ikada no longer redefines Tailwind's `text-*` sizes for the rest of your app. The registry theme only defines `--text-sb-*`. The npm `theme.css` also keeps the plain `--text-*` sizes for 0.1.x apps; they are deprecated and will go in 0.3.0.
- **Smaller class helpers.** `tailwind-variants` is replaced by a small built-in `tv()` (about 0.4 kB), which removes a second bundled copy of `tailwind-merge`. Importing `Button` costs 16.4 kB gzip over React DOM, down from 33.6 kB (same measurement, Base UI included in both).
- `@base-ui/react` and `@tanstack/charts` are peer dependencies (`^1.9.0` and `^1.2.1`; charts is optional) instead of dependencies, so your app has one copy of Base UI. `tailwind-variants` is no longer a dependency.
- The tarball ships `dist`, `src`, `CHANGELOG.md`, `README.md` and `LICENSE`; `DESIGN.md` and `INVENTORY.md` are on GitHub only.

### Migrating from 0.1.0

1. **Install the peers**: `npm i @base-ui/react` (and `@tanstack/charts` if you import `@sproutboat/ikada/charts`).
2. **Remove the workarounds.** Delete `transpilePackages: ["@sproutboat/ikada"]` from `next.config`, and the manual `@source "../node_modules/@sproutboat/ikada/src"` line: `@import "@sproutboat/ikada/theme.css"` covers it. Keep your own `@source` only if you also scan other packages.
3. **Switch dark mode to the class.**
   - Apps that were dark by default: add `class="dark"` to `<html>` (or use `next-themes` with `attribute="class"` and `defaultTheme="dark"`). Without it the app now opens light.
   - Apps that set `data-theme="light"`: remove it; light is the default. `data-theme` keeps working this release.
   - A `data-theme` attribute on a nested element still re-scopes the tokens for that subtree; prefer a `dark` class there too.
4. **Rename the type utilities** in your own markup if you used ikada's sizes through the plain names: `text-md`, `text-metric` and the ikada values of `text-sm`/`text-base`/`text-lg` become `text-sb-sm`, `text-sb-base`, `text-sb-lg`, `text-sb-md`, `text-sb-metric`. Until 0.3.0 the plain names still resolve to ikada's values when you import the npm `theme.css`.
5. **`buttonStyles` and the other style helpers** keep the same call shape (`buttonStyles({ variant, size, className })`). `VariantProps` now comes from `@sproutboat/ikada` internals, not `tailwind-variants`; if you imported that type from `tailwind-variants` for `buttonStyles`, use `ButtonVariants` from `/ikada/button`.
6. **Subpath imports are new**: `@sproutboat/ikada/button` is optional; the barrel still tree-shakes.

## 0.1.0

First release: tokens, 42 components on Base UI and Tailwind v4, charts, the shadcn registry. Raw TypeScript source.
