/**
 * The ikada mark's motion: CSS for the press and the first paint (site.css), WAAPI for the rest.
 * Only transform and opacity, on SVG groups. Units are the 24-grid's user units (transform-box:
 * view-box), so every move scales with the mark: 1 unit is 1 px at 24 px.
 *
 * Every one-shot starts from the value on screen (read before the old animation is cancelled),
 * so a hover, a press, a success or the end of loading can interrupt any other without a jump.
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

/** One wavelength of the E4 24-grid wave, in user units: the flow moves this far per loop. */
const WAVELENGTH = 19;
const LOOP_MS = 1400;
const FADE_MS = 160;
const HANDOFF_MS = 120;

export const TIMING = {
  hover: { dip: 1, ripple: 0.35 },
  press: { ripple: 0.5 },
  loading: { delay: 400, lift: 0.6, tilt: 1.5 },
  success: { rise: -2, up: 160, ring: 700, peak: 0.6 },
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
const xOf = (el: Element) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
const ignore = () => {};

const mounted = new WeakMap<SVGSVGElement, IkadaMarkMotion>();

/** The motion API for one `.ikm` SVG (the 24-grid drawing). Returns null for the static 16-grid one. */
export function mount(svg: SVGSVGElement): IkadaMarkMotion | null {
  const known = mounted.get(svg);
  if (known) return known;
  const q = (s: string) => svg.querySelector<SVGGraphicsElement>(s);
  const bob = q(".ikm-bob");
  const wave = q(".ikm-wave");
  const echo = q(".ikm-echo");
  const flow = q(".ikm-flow");
  const wrap = q(".ikm-flowwrap");
  const cut = q(".ikm-cut"); // the waterline inside the raft's mask: it moves with the flow
  if (!bob || !wave || !echo || !flow || !wrap || !cut) return null;
  const flowing = [flow, cut];
  let loading = false;
  let pending: ReturnType<typeof setTimeout> | undefined;

  // One ripple: a copy of the wave that spreads down and out and fades.
  const ripple = (peak: number, { delay = 0, duration = 600, drop = 2, spread = 1.12 } = {}) =>
    play(
      echo,
      [
        { opacity: 0, transform: "none" },
        { opacity: peak, offset: 0.2 },
        { opacity: 0, transform: `translateY(${drop}px) scaleX(${spread})` },
      ],
      // backwards: through the delay, hold the captured frame (a ripple still fading out), not the base.
      { duration, delay, easing: EASE_OUT, fill: "backwards" },
    );

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
      // Nothing moves; the wave breathes, like the library's skeletons.
      play(wave, [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], {
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
    // One wavelength per bob; resume from wherever the flow is (a quick off/on carries on).
    const len = WAVELENGTH;
    const start = (((xOf(flow) % len) + len) % len) / len;
    for (const el of flowing) {
      cancel(el);
      el.animate([{ transform: "translateX(0px)" }, { transform: `translateX(${len}px)` }], {
        duration: LOOP_MS,
        iterations: Infinity,
        iterationStart: start,
        easing: "linear",
      });
    }
    play(wave, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: EASE_OUT, fill: "forwards" });
    play(wrap, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_OUT, fill: "forwards" });
  };

  const end = (quick: boolean) => {
    loading = false;
    delete svg.dataset.loading;
    const settle = () => {
      if (!loading) flowing.forEach(cancel);
    };
    if (!running(flow)) {
      // Reduced motion (or never flowed): the breathing wave fades back to full.
      play(wave, [{ opacity: 1 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_OUT });
      return;
    }
    // The raft springs home from wherever it is.
    play(bob, [{ transform: "none" }, { transform: "none" }], { duration: bobMs(), easing: spring() });
    const len = WAVELENGTH;
    if (quick) {
      // Handed to success: no run-out. The waves cross-fade where they stand and the waterline cut
      // glides to the nearest whole wavelength, so one water line is on screen when the ring goes out.
      play(wave, [{ opacity: 0 }, { opacity: 1 }], { duration: HANDOFF_MS, easing: EASE_OUT });
      const cx = xOf(cut);
      play(cut, [{ transform: "none" }, { transform: `translateX(${Math.round(cx / len) * len}px)` }], {
        duration: HANDOFF_MS,
        easing: EASE_OUT,
        fill: "forwards",
      });
      play(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: HANDOFF_MS, easing: EASE_OUT, fill: "forwards" })
        .finished.then(settle)
        .catch(ignore);
      return;
    }
    // The flow runs on to the next whole wavelength, easing out from the speed it had (easeOutSine
    // starts at 1.64x linear, so the duration stretches to match), then the resting wave takes over:
    // same geometry, so no seam.
    const x = xOf(flow);
    const left = len - (((x % len) + len) % len);
    // Too short a coast would have to brake hard; run on one more wavelength instead.
    const rest = left < len * 0.2 ? left + len : left;
    const duration = 1.64 * (rest / len) * LOOP_MS;
    let done: Animation | undefined;
    for (const el of flowing) {
      const a = play(el, [{ transform: "none" }, { transform: `translateX(${x + rest}px)` }], {
        duration,
        easing: SINE_OUT,
        fill: "forwards",
      });
      if (el === flow) done = a;
    }
    done?.finished
      .then(() => {
        if (loading) return;
        play(wave, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_OUT });
        return play(wrap, [{ opacity: 1 }, { opacity: 0 }], {
          duration: FADE_MS,
          easing: EASE_OUT,
          fill: "forwards",
        }).finished.then(settle);
      })
      .catch(ignore);
  };

  const api: IkadaMarkMotion = {
    // Mouse only, once per entry, never restarted while it plays: a 1-unit nudge.
    hover() {
      if (reduced() || loading || running(bob)) return;
      nudge(TIMING.hover.dip, pressMs());
      ripple(TIMING.hover.ripple, { delay: pressMs() });
    },
    // The CSS transition on .ikm-raft carries the raft; the water answers the push.
    // A hover dip still in flight heads home in the same 90 ms, so the two never add past 1 unit.
    press(down) {
      if (!down || reduced() || loading) return;
      if (running(bob))
        play(bob, [{ transform: "none" }, { transform: "none" }], { duration: pressMs(), easing: EASE_OUT });
      ripple(TIMING.press.ripple, { delay: pressMs() });
    },
    loading(on, { delay = TIMING.loading.delay } = {}) {
      clearTimeout(pending);
      pending = undefined;
      if (on === loading) return;
      if (on) pending = setTimeout(begin, delay);
      else end(false);
    },
    // The raft rises once and settles on the bob spring; the water sends out one ring, on the
    // success glyph's own timing. A loading loop hands off in 120 ms first. Reduced: stillness.
    success() {
      clearTimeout(pending);
      pending = undefined;
      // A loop, or a run-out already coasting (loading=false and success=true in one render), hands off.
      const handoff = loading || running(flow);
      if (handoff) end(true);
      if (reduced()) return;
      nudge(TIMING.success.rise, TIMING.success.up);
      const { ring: duration, peak } = TIMING.success;
      ripple(peak, { duration, drop: 3, spread: 1.2, delay: handoff ? HANDOFF_MS : 0 });
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
