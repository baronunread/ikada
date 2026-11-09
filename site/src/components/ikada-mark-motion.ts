/**
 * The ikada mark's motion: CSS for the press and the first paint (site.css), WAAPI for the rest. Only
 * transform and opacity on the raft group. Units are the 24-grid's user units (transform-box: view-box),
 * so every move scales with the mark: 1 unit is 1 px at 24 px.
 *
 * Every one-shot starts from the value on screen (read before the old animation is cancelled), so a
 * hover, a press, a success or the end of loading can interrupt any other without a jump.
 *
 * Plain DOM, no React: the docs header is server-rendered and wired by `wireAll()`, and the React
 * component mounts the same API when it hydrates. `mount()` and `wire()` are idempotent.
 */

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // --ease-out
// easeOutSine / easeInSine quarters for the loading bob: it passes the rest line at speed and turns
// round softly at the top and bottom (half a sine, not an ease-in entrance).
const SINE_OUT = "cubic-bezier(0.61, 1, 0.88, 1)";
const SINE_IN = "cubic-bezier(0.12, 0, 0.39, 0)";
const SINE_IN_OUT = "cubic-bezier(0.37, 0, 0.63, 1)";

const LOOP_MS = 1400;

export const TIMING = {
  hover: { dip: 1 },
  loading: { delay: 400, lift: 0.6, tilt: 1.5 },
  success: { rise: -2, up: 160 },
} as const;

export interface IkadaMarkMotion {
  hover(): void;
  press(down: boolean): void;
  /** Starts after `delay` ms (400 by default) so short loads never show it; stops seamlessly. */
  loading(on: boolean, options?: { delay?: number }): void;
  success(): void;
  /** Stop everything at once, with no run-out (the mark is leaving the page). */
  dispose(): void;
  readonly isLoading: boolean;
}

const root = () => document.documentElement;
// The same switch as theme.css: the OS setting, or data-motion="reduce" on <html>.
const reduced = () => root().dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (name: string) => getComputedStyle(root()).getPropertyValue(name).trim();
const spring = () => token("--sb-spring-bob") || EASE_OUT;
const ms = (name: string, fallback: number) => {
  const v = token(name);
  if (!v) return fallback;
  return v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : fallback;
};
const bobMs = () => ms("--sb-duration-spring-bob", 675);
const pressMs = () => ms("--sb-duration-press", 90);

type Frame = Keyframe & { transform?: string; opacity?: number | string };

/** Start from what is on screen: frame 0's transform and opacity become the computed values, then
 * every animation on the element (CSS ones included) is cancelled. */
function play(el: Element, frames: Frame[], options: KeyframeAnimationOptions): Animation {
  const cs = getComputedStyle(el);
  const first: Frame = { ...frames[0] };
  if ("transform" in first) first.transform = cs.transform;
  if ("opacity" in first) first.opacity = cs.opacity;
  for (const a of el.getAnimations()) a.cancel();
  return el.animate([first, ...frames.slice(1)], options);
}
const cancel = (el: Element) => el.getAnimations().forEach((a) => a.cancel());
const running = (el: Element) => el.getAnimations().some((a) => a.playState === "running");
const ignore = () => {};

const mounted = new WeakMap<SVGSVGElement, IkadaMarkMotion>();

/** The motion API for one `.ikm` SVG (the 24-grid drawing). Returns null for the static 16-grid one. */
export function mount(svg: SVGSVGElement): IkadaMarkMotion | null {
  const known = mounted.get(svg);
  if (known) return known;
  const bob = svg.querySelector<SVGGraphicsElement>(".ikm-bob");
  if (!bob) return null;
  let loading = false;
  let pending: ReturnType<typeof setTimeout> | undefined;

  // The raft moves by d in `lead` ms with --ease-out, then comes home on the bob spring.
  const nudge = (d: number, lead: number) => {
    const total = lead + bobMs();
    play(
      bob,
      [
        { transform: "none", easing: EASE_OUT },
        { transform: `translateY(${d}px)`, offset: lead / total, easing: spring() },
        { transform: "none" },
      ],
      { duration: total },
    );
  };

  const begin = () => {
    loading = true;
    svg.dataset.loading = "";
    if (reduced()) {
      // Nothing moves; the raft breathes, like the library's skeletons.
      play(bob, [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], {
        duration: LOOP_MS,
        iterations: Infinity,
        easing: SINE_IN_OUT,
      });
      return;
    }
    const { lift: a, tilt: r } = TIMING.loading;
    const crest = `translateY(${a}px) rotate(${r}deg)`;
    // Lead in from rest to the first crest (ease in and out, so it starts from standstill), then
    // loop from that crest, where the loop's speed is zero too: no jerk at either seam.
    play(bob, [{ transform: "none" }, { transform: crest }], { duration: LOOP_MS / 4, easing: SINE_IN_OUT })
      .finished.then(() => {
        if (!loading) return;
        bob.animate(
          [
            { transform: "none", easing: SINE_OUT },
            { transform: crest, offset: 0.25, easing: SINE_IN },
            { transform: "translateY(0px) rotate(0deg)", offset: 0.5, easing: SINE_OUT },
            { transform: `translateY(${-a}px) rotate(${-r}deg)`, offset: 0.75, easing: SINE_IN },
            { transform: "translateY(0px) rotate(0deg)" },
          ],
          { duration: LOOP_MS, iterations: Infinity, iterationStart: 0.25 },
        );
      })
      .catch(ignore);
  };

  const end = () => {
    loading = false;
    delete svg.dataset.loading;
    // The raft springs home from wherever it is (or the breathing fades back to full).
    play(
      bob,
      [
        { transform: "none", opacity: 1 },
        { transform: "none", opacity: 1 },
      ],
      { duration: bobMs(), easing: spring() },
    );
  };

  const api: IkadaMarkMotion = {
    // Mouse only, once per entry, never restarted while it plays: a 1-unit nudge.
    hover() {
      if (reduced() || loading || running(bob)) return;
      nudge(TIMING.hover.dip, pressMs());
    },
    // The CSS transition on .ikm-raft carries the raft. A hover dip still in flight heads home in the same 90 ms.
    press(down) {
      if (!down || reduced() || loading) return;
      if (running(bob))
        play(bob, [{ transform: "none" }, { transform: "none" }], { duration: pressMs(), easing: EASE_OUT });
    },
    loading(on, { delay = TIMING.loading.delay } = {}) {
      clearTimeout(pending);
      pending = undefined;
      if (on === loading) return;
      if (on) pending = setTimeout(begin, delay);
      else end();
    },
    // The raft rises once and settles on the bob spring. A loading loop hands off first. Reduced: stillness.
    success() {
      clearTimeout(pending);
      pending = undefined;
      if (loading) end();
      if (reduced()) return;
      nudge(TIMING.success.rise, TIMING.success.up);
    },
    dispose() {
      clearTimeout(pending);
      pending = undefined;
      loading = false;
      for (const a of svg.getAnimations({ subtree: true })) a.cancel();
      mounted.delete(svg);
    },
    get isLoading() {
      return loading;
    },
  };
  mounted.set(svg, api);
  return api;
}

const wired = new WeakSet<Element>();

/** Hover (fine pointers only) and press (any pointer) on the mark's link or button. Keyboard
 * activation never animates: Enter navigates. Returns a function that unwires. */
export function wire(host: HTMLElement, api: IkadaMarkMotion): () => void {
  if (wired.has(host)) return () => {};
  wired.add(host);
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const enter = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && fine.matches) api.hover();
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    host.setAttribute("data-ikm-pressed", "");
    api.press(true);
  };
  const up = () => host.removeAttribute("data-ikm-pressed");
  const ups = ["pointerup", "pointercancel", "pointerleave", "blur"] as const;
  host.addEventListener("pointerenter", enter);
  host.addEventListener("pointerdown", down);
  for (const t of ups) host.addEventListener(t, up);
  return () => {
    wired.delete(host);
    up();
    host.removeEventListener("pointerenter", enter);
    host.removeEventListener("pointerdown", down);
    for (const t of ups) host.removeEventListener(t, up);
  };
}

/** The first-paint drop is a CSS animation gated by `data-ikm-intro` on <html> (set once per
 * session before first paint). Clear the flag when it is over, so marks mounted later stay still. */
function clearIntro(svg: SVGSVGElement) {
  if (!("ikmIntro" in root().dataset)) return;
  // Every intro animation in the mark (the drop and fade on the raft, the ring on the water, or the
  // lone fade under reduced motion). One that JS motion cancels has been taken over from where it
  // stood, so clearing the flag cannot make the others jump: it waits for all of them.
  const intro = svg.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation);
  Promise.allSettled(intro.map((a) => a.finished)).then(() => delete root().dataset.ikmIntro);
}

/** Wire every interactive mark already in the page (the server-rendered header). */
export function wireAll(scope: ParentNode = document): void {
  for (const svg of scope.querySelectorAll<SVGSVGElement>('svg.ikm[data-ikm-motion="interactive"]')) {
    const api = mount(svg);
    const host = svg.closest<HTMLElement>("a, button");
    if (api && host) wire(host, api);
    clearIntro(svg);
  }
}
