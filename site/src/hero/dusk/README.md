# Raft at dusk

One WebGPU scene (TypeGPU) shared by sproutboat.com, its docs and the ikada site, each with its own camera. A raft of
two lashed logs carrying the Sproutboat sprout, on a sea at dusk, with an island on the horizon. Dark theme is blue
hour, light is golden hour.

**Source of truth: this folder** (`baronunread/ikada`, `site/src/hero/dusk/`). Other sites vendor a copy:

```sh
bun <ikada>/site/scripts/sync-dusk.ts web/src/hero/dusk           # copy + VENDORED (version, commit)
bun <ikada>/site/scripts/sync-dusk.ts web/src/hero/dusk --check   # CI: fail if the copy drifted
```

Bump `DUSK_VERSION` in `index.ts` when the contract or the picture changes. The scene was designed in
`mockups-20261104/shader-concepts/dusk-v2/` (NOTES.md, PERF.md); this folder is now ahead of it.

| File         |                                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| `index.ts`   | the public entry: `mount`, the types, `DUSK_VERSION`, the hand-off helpers       |
| `scene.ts`   | the simulation, the camera presets, the adaptive-resolution guard, the mount     |
| `shader.ts`  | the fragment shader (TGSL, compiled to WGSL at build time by `unplugin-typegpu`) |
| `gpu.ts`     | TGSL helpers (noise, contrast mask, sRGB encode) and OKLCH on the CPU            |
| `handoff.ts` | `saveHandoff`, `takeHandoff`, and the two inline scripts for the page            |

Needs `typegpu` (0.12) and `unplugin-typegpu` with this folder in its `include`. `shader.ts` and `gpu.ts` are
`@ts-nocheck`: TGSL vector operators are valid for the transpiler but not for `tsc`.

## API

```ts
mount(canvas: HTMLCanvasElement, opts: MountOptions): Promise<Handle>

interface MountOptions {
  camera: 'wide' | 'raft' | 'sky';
  theme: 'light' | 'dark';
  state?: DuskState;       // from getState() on the previous page: the first frame renders it exactly, then the camera glides
  reduced?: boolean;       // one still frame, no loop, presses ignored, camera changes cut
  host?: HTMLElement;      // pointer listeners (passive); default canvas.parentElement
  mask?: Rect[];           // contrast zones (canvas uv, up to 4): the shader mixes toward the page canvas by k
  maxDpr?: number;         // default 1 desktop, 1.25 coarse pointer
  maxFps?: number;         // default 60 desktop, 30 coarse pointer
  budgetMs?: number;       // guard threshold on the raw pass time, default 8
  adaptive?: boolean;      // guard on/off, default on
  ignore?: string;         // presses on these never send a swell (default: links, buttons, form controls)
  onStats?(s: Stats): void;
  onFirstFrame?(): void;   // right after the first frame is submitted: reveal the canvas here
}

interface Handle {
  backend: 'webgpu' | 'static';   // 'static': no WebGPU (or a pipeline error); keep the poster
  setCamera(name, { animate = true }?): void;  // ~600 ms glide; cuts under reduced motion or animate: false
  getState(): DuskState;          // JSON-safe
  destroy(): void;
  setTheme(t): void;              // eased: the sun rises from blue hour to golden hour (snaps when reduced)
  setReduced(b): void;
  setMask(rects, { animate }?): void;  // animate eases from the drawn mask (~420 ms)
  tap(u, v): void;                // a swell from the sea under canvas uv (from the horizon on the sky)
  snapshot(type?, quality?): string | null;   // re-renders the current state, returns a data URL
  pause(); resume(); running(): boolean;
}
```

`DuskState` (`v: 3`) holds time, the springs (camera truck and tilt, raft bob, roll and pitch, sprout sway, pointer,
theme, and one weight per camera preset), the swells in flight, pointer presence, the render scale, the camera it is
heading to, and the mask as drawn. A v2 state from the dusk-v2 mockup is accepted. **The picture is a pure function
of the state and the canvas size**, which is what makes the hand-off exact.

## Cameras

Each preset is a framing solved for the canvas's aspect ratio (portrait and landscape values, blended): focal length,
where the horizon and the raft sit (canvas v), the raft's width, where the sun and the island sit (canvas u).

|        | used by        | framing                                                                            |
| ------ | -------------- | ---------------------------------------------------------------------------------- |
| `wide` | sproutboat.com | the raft small and low, drifting toward the island; the headline on open sky       |
| `raft` | ikada          | closer on the raft and the sprout, low in the frame; the headline on the sky above |
| `sky`  | the docs       | tilted up into the calm sky; a strip of sea, the raft below the frame              |

`setCamera` moves the preset weights on Afloat's critically damped spring (response 0.4 s, no overshoot: in Afloat
only a press bobs), so a glide settles in ~550 ms and an interrupted glide carries its velocity. The waves' drift is a
constant, so a glide or a resize never shifts the sea's phase.

## The page

1. A box for the scene with a poster `<img>` and the `<canvas>` on top (both `inset: 0`). The canvas starts at
   `opacity: 0` and is revealed in `onFirstFrame` (a 500 ms fade on a fresh load, none under `html.dusk-exact`).
2. Posters: the stills a fresh load starts from (a fresh scene is pre-settled at t = 26.4 s, so its first frame is the
   poster), one per theme and width (1440, 390). Regenerate them from the page itself; ikada's are
   `site/public/hero/dusk-raft-*.webp` (`bun scripts/verify-hero.ts posters`). They are also the no-WebGPU fallback.
3. Load the module after first paint (dynamic `import()`); the poster is the first paint.
4. Feed the contrast mask from the text's boxes (`setMask` on resize and when fonts load).

## Hand-off

Navigating between pages that show the scene carries it instead of restarting: same time, same swells, same raft
pose, and the camera glides from the old page's preset to the new one.

1. **Leaving** (`pageswap`, `pagehide` as the fallback), only toward a page that shows the scene:
   `saveHandoff(handle, canvas, theme)` stores the state and the last frame as a PNG (lossless; ~40 ms at 1440×900;
   WebP if the PNG would not fit) in `sessionStorage['dusk:handoff']`.
2. **Arriving, in `<head>`** after the theme is set: `HEAD_SCRIPT` reads and removes it, and keeps it if it is under
   20 s old and in the same theme (`window.__duskHandoff`).
3. **Right after the poster `<img data-dusk-poster="…{theme}…{size}…" decoding="sync">`**: `POSTER_SCRIPT` shows the
   stored frame if the box is the same size as the one it was drawn for (and sets `html.dusk-exact`); otherwise this
   camera's poster for the theme.
4. **Mount** with `state: takeHandoff()?.state`. The first frame is drawn with dt = 0 and the previous page's mask,
   so it is the stored frame to the pixel; then the mask eases to this page's text and the camera glides to `camera`.
5. **View transition**: `@view-transition { navigation: auto; }` on both pages and `view-transition-name: dusk-hero` on
   the box. With an exact hand-off both snapshots are the same picture, so the group swaps with no animation;
   otherwise a short crossfade (ikada's `site/src/styles/vt.css`).

For an exact hand-off between two sites the boxes must be the same size: ikada uses the whole hero from the top of
the page, `min-height: clamp(640px, 100svh, 1080px)`. A different size, theme or an old entry still carries the state
(continuous time, the glide), over the poster with the usual fade.

## Guard (adaptive resolution)

Down when the raw pass time is over `budgetMs`, or frames drop, for 2 s, by a step proportional to the overrun (×0.6
to ×0.9, floor 0.5). Up by probing: after a few calm seconds the scale steps ×1.25 and the next 3 s decide; over again
→ back down and the wait doubles (max 64 s). The threshold is not the cost budget: at light load the GPU clocks down
and a 1 ms frame reads 3–5 ms when timed alone. Off-screen (IntersectionObserver) or a hidden tab: no frames.

## Frame cost

Budget 5 ms desktop, 2 ms phones, measured at full clock with `?bench=10` (ten complete passes per frame timed
together; never draw the triangle N times in one pass, tile-based GPUs discard covered fragments).
`bun scripts/verify-hero.ts perf` prints it for the ikada homepage.

## Verify

`site/scripts/verify-hero.ts` (headless Chrome with WebGPU, against `bun run preview`): `posters`, `shots`,
`contrast` (headline ≥ 3:1, lede and nav ≥ 4.5:1 on the worst rendered pixel), `handoff` (max channel difference
between the last frame and the first, and the wide → raft glide), `reduced`, `static` (no WebGPU), `perf`, `rec`.

## The container ship (mock, branch `dusk-ship-mock`)

A chunky toy container ship steams across the scene (heading toward the sun, bow left), carrying stacks of coloured
containers, some open with sprouts in soil; the ikada raft is its tender. It is a second fragment pass
(`shipFrag` in `shader.ts`, premultiplied over the scene, scissored to the ship's screen rectangle by
`Sim.shipRect`), so its registers never touch the scene pass; the scene pass only adds the wake (foam skirt, bow
ridges, stern trail), a flat cut-out reflection and the contact darkening. The ship lies at a fixed place in the world
(`SHIP_AT`, per aspect); a camera glide is a real move toward the raft. Presets gained `ux` (canvas u of the raft: the
camera slides sideways), `bl` (defocus in radians: soft silhouette, averaged paint, cheaper marching) and `so` (ship
opacity; 0 on `sky`). The cargo is a hand-authored table (`CARGO`, uploaded as the `cells` uniform).
The mock page, build and tools are in `site/mock/dusk-ship/` (`bun build.ts`, `bun serve.ts`, `node tools/shots.sh`).
