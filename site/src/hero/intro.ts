/**
 * The /ikada intro (the chart's zoom, the blueprint opening, the ink drawing on) plays once per browser session.
 *
 * It plays in full on the first visit of a session and always when the visitor arrives from another page through the
 * hand-off (a reload stores a hand-off too, but from this same page, so it does not count). A reload, back or forward and any later direct visit in the same session show the settled blueprint at once
 * (with a ~200 ms fade): no zoom, no ink. `sessionStorage["ikada:intro"]` is set when the intro has finished, or when the
 * page is left before it has.
 *
 * INTRO_SCRIPT runs in <head>, right after the hand-off script, so the page knows before first paint: html[data-intro="seen"]
 * paints the sheet's paper colour straight away (home.css), so there is no flash of the chart and nothing moves.
 */
export const INTRO_KEY = "ikada:intro";
export const INTRO_SCRIPT = `(()=>{try{{const h=window.__chartHandoff;if(sessionStorage.getItem(${JSON.stringify(INTRO_KEY)})==="1"&&(!h||h.from===location.pathname))document.documentElement.dataset.intro="seen"}}catch{}})();`;

/** the intro counts as seen */
export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* storage blocked: the intro plays every time, as before */
  }
}
export const introSeen = (): boolean => document.documentElement.dataset.intro === "seen";
