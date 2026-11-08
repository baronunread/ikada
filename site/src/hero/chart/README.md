# The nautical chart

One Canvas 2D chart shared by sproutboat.com, its docs and the ikada site, each with its own camera on **one continuous
zoom**. Contour lines drift, soundings and a compass rose sit on a graticule, apps are precise vessel markers around
Sprout Harbour, and ikada is a small raft moored at the harbour's mouth. Monoline, one green accent. It needs no WebGPU
and no secure context. Dark and light follow the Sproutboat tokens: the deepest water is the page's canvas colour, so
the sheet sits on the page with no seam.

**Source of truth: this folder** (`baronunread/ikada`, `site/src/hero/chart/`). Other sites vendor a copy:

```sh
bun <ikada>/site/scripts/sync-chart.ts web/src/hero/chart           # copy + VENDORED (version, commit)
bun <ikada>/site/scripts/sync-chart.ts web/src/hero/chart --check   # CI: fail if the copy drifted
```

Bump `CHART_VERSION` in `index.ts` when the contract or the picture changes. The chart was designed as concept G in
`mockups-20261104/hero-fullscreen/`; this folder is now ahead of it.

| File                            |                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `index.ts`                      | the public entry: `mount`, the types, `CHART_VERSION`, the hand-off helpers      |
| `scene.ts`                      | the renderer, the simulation, the cameras, the input, the DOM markers, the mount |
| `world.ts`                      | the seeded map: depth field, coast, harbour, names, vessels, routes, soundings   |
| `palette.ts`                    | the two palettes in OKLCH, resolved once                                         |
| `handoff.ts`                    | `saveHandoff`, `takeHandoff`, and the two inline scripts for the page            |
| `instrument-serif-italic.woff2` | the italic serif of the place names (loaded by the module, canvas text)          |

## The map is deterministic

`world.ts` has no `Math.random` and no DOM input: the coast, the islet and the shoal, the 24 + 10 vessels and their
routes, the soundings and the names come from fixed seeds on a 1440 x 900 unit sheet. Every page that mounts the chart
draws the identical map, whatever its camera or canvas size. Only the sea's slow drift moves, and it is a pure function
of the clock. Clicks use `Math.random` (a deployed vessel's route), which is fine: they are not the map.

## API

```ts
mount(canvas: HTMLCanvasElement, opts: MountOptions): Promise<Handle>

interface MountOptions {
  camera: 'wide' | 'raft' | 'corner';
  theme: 'light' | 'dark';
  state?: ChartState;      // from getState() on the previous page: the first frame renders it exactly, then the camera glides
  reduced?: boolean;       // one static, informative frame; no drift, no idle demo, camera changes cut; presses still answer
  host?: HTMLElement;      // pointer listeners (passive); default canvas.parentElement
  markers?: HTMLElement;   // a box over the hero for the marker buttons and the live region (inside <main>)
  raftHref?: string;       // the raft marker is a link to this (sproutboat.com: '/ikada'); without it, it wakes
  mask?: Mask;             // what the text covers (canvas px): { copy: Rect | null, navH }
  ignore?: string;         // presses on these never deploy or sweep (default: links and form controls)
  maxDpr?: number;         // default 2 desktop, 1.5 coarse pointer
  words?: Partial<Words>;  // the legend, hint and caption (default: sproutboat.com's)
  onStats?(s: Stats): void;
  onFirstFrame?(): void;   // right after the first frame is drawn: reveal the canvas here
}

interface Handle {
  backend: 'canvas' | 'static';   // 'static': no 2D context; keep the poster
  setCamera(name, { animate = true }?): void;  // ~650 ms critically damped glide; cuts under reduced motion or animate: false
  getState(): ChartState;         // JSON-safe
  setTheme(t): void;  setReduced(b): void;
  setMask(m, { animate }?): void; // eases the veil and the contours (~420 ms)
  snapshot(type?, quality?): string | null;   // re-renders the current state (no hover label), returns a data URL
  stats(): Stats;                 // frames, cpu ms (mean, p95, max) per frame, fps, dpr
  tune({ density, wake, names, furniture, veil }): void;   // the blueprint view and design studies tune the chart under it
  pause(); resume(); running(): boolean; destroy(): void;
  vessels(), raftPoint(), wake(i), deploy(x, y), sweep()   // tests and tours
}
```

`ChartState` (`v: 1`) holds the clock, the camera springs (and the preset it heads for), each vessel's wake state, the
effects in flight (routes, launches, the sweep, labels), the mask as drawn and the hint. **The picture is a pure function
of the state, the canvas size and the theme**, which is what makes the hand-off exact.

## Cameras

A camera is a world point pinned at a screen position plus a zoom over cover-fit, with a landscape and a portrait
framing blended by aspect. The glide is three springs (centre x, centre y, log zoom) with the same response, so pan and
zoom land together.

|          | used by        | framing                                                                                              |
| -------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `wide`   | sproutboat.com | the whole sheet; the headline on the calm sea at the top left, the harbour on the right              |
| `raft`   | ikada          | 2.9x on the raft at the harbour's mouth (right of centre), the headline on open sea                  |
| `corner` | the docs       | 1.8x on the quiet deeps at the lower left: contours, soundings, a few vessels; no scene is wired yet |

sproutboat.com to /ikada is one camera move and back is the reverse: the page that is leaving sends `setCamera` on the
click, the state (mid-glide) carries over, and the arriving page continues the same glide.

## Furniture and zoom

The neatline, tick marks, compass, scale bar, legend, hint and caption are screen furniture; the graticule, its labels,
the soundings and the names are anchored to the world. The graticule has two levels that crossfade as the zoom changes
(5' lines at 1x, 2.5' at 2x), a second tier of soundings and the half-interval contours fade in past 1.6x, and the
scale bar picks a nearest-nice fraction of a nautical mile.

## Interaction

- Click or tap a vessel: radar ping, its route draws to Sprout Harbour, label `hostname · running · N ms` (5 to 8 ms).
- Click open water: a new vessel launches along a drawn route from the harbour and is `deployed` where you clicked.
- Press and hold (430 ms): a radar sweep from the harbour wakes the vessels in range. Release ends it.
- Idle for 3 s (motion allowed): the chart pings vessels, deploys one every sixth beat and sweeps every ~20 s.
- The hint fades after the first press. Clicks only, nothing to type.
- Markers are real `<button>`s in `opts.markers` (one roving tab stop for the vessels with arrow keys, Home and End; the
  raft is its own stop, a link when `raftHref` is set). Hover and keyboard focus show the label; the live region
  announces results. Vessels under the text or off screen have no button.
- Labels are drawn on the canvas, so a hand-off carries them.

Hostnames are `<app>.<account>.sproutboat.app`. Real numbers: wake 5 to 8 ms, 1.28 MiB per idle app, 1,000 apps on one
server. The caption labels the simulation as illustrative.

## The page

1. A box for the chart with a poster `<img>` and the `<canvas>` on top (both `inset: 0`), and a second box over the hero
   for the markers. The canvas starts at `opacity: 0` and is revealed in `onFirstFrame` (a 500 ms fade on a fresh load,
   none under `html.chart-exact`). The hero text takes `pointer-events: none` except links, so presses reach `host`.
2. Posters: the stills a fresh load starts from, one per camera, theme and width (1440, 390), rendered from the page
   itself with `?chart=freeze` (ikada's are `site/public/hero/chart-raft-*.webp`, `bun scripts/verify-chart.ts posters`).
   They are also the no-JS and no-canvas fallback, and show the informative state (one vessel awake, route, label).
3. Load the module after first paint (dynamic `import()`); the poster is the first paint.
4. Feed the mask from the text's union box and the header height (`setMask` on resize and when fonts load).

## Hand-off

Navigating between pages that show the chart carries it instead of restarting: same clock, same vessels and effects,
and the camera glides from the old page's preset to the new one.

1. **Leaving** (`pageswap`, `pagehide` as the fallback), only toward a page that shows the chart:
   `saveHandoff(handle, canvas, theme)` stores the state and the last frame in `sessionStorage['chart:handoff']`
   (PNG when it fits, WebP otherwise).
2. **Arriving, in `<head>`** after the theme is set: `HEAD_SCRIPT` reads and removes it and keeps it if it is under 20 s
   old and in the same theme (`window.__chartHandoff`).
3. **Right after the poster `<img data-chart-poster="…{theme}…{size}…" decoding="sync">`**: `POSTER_SCRIPT` shows the
   stored frame if the box is the same size as the one it was drawn for (and sets `html.chart-exact`); otherwise this
   camera's poster for the theme.
4. **Mount** with `state: takeHandoff()?.state`. The first frame is drawn with dt = 0 and the previous page's mask, so it
   is the stored frame to the pixel; then the mask eases to this page's text and the camera glides to `camera`.
5. **View transition**: `@view-transition { navigation: auto; }` on both pages and `view-transition-name: chart-hero` on
   the box. With an exact hand-off both snapshots are the same picture, so the group swaps with no animation.

For an exact hand-off between two sites the boxes must be the same size: both use the whole hero from the top of the
page, `min-height: clamp(640px, 100svh, 1080px)`.

## Performance

Layers: a base (tint raster, land and coast strokes, graticule, soundings, names, harbour; redrawn only when the camera,
size, theme or mask moves), the contours and routes (marching squares on a screen grid, every 50 ms, every frame while
the camera moves), composited under the live effects (vessels, rings, sweep, labels) each frame. The depth field is
sampled once on a 3-unit grid and read bilinearly. The pixel ratio is capped (2 desktop, 1.5 coarse) and stepped down
by a guard after a slow stretch. No frames while the page is hidden or the hero is off screen. `handle.stats()` and
`bun scripts/verify-chart.ts perf` print the cost.

## Verify

`site/scripts/verify-chart.ts` (headless Chrome against `bun run preview`): `posters`, `shots`, `handoff`, `perf`,
`reduced`, `rec`.

## The blueprint (ikada's hero)

On /ikada the chart zooms to the raft and `site/src/hero/blueprint/` opens over it: a drafting sheet whose seven parts are
real ikada components (Button, Tooltip, Toast, Tabs, Select, Dialog, Switch). The sheet is a page-level React island
(`site/src/components/HeroBlueprint.tsx`), not part of this module: it waits for the chart (`hero:ready`), opens the paper
from the raft marker (`raftScreenPx` from `cameras.ts`), and tells the page to park the chart's frames (`hero:sheet`).
sproutboat.com to /ikada is the chart's zoom with the paper opening as the camera settles; Back is the chart zooming out
(the sheet is page content, so it leaves with the page, and the chart underneath carries over through the hand-off).
