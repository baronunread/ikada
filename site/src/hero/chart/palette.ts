// The chart's two palettes, written in OKLCH against the Sproutboat tokens (--sb-canvas, --sb-fg and the green
// accent) and resolved to "r,g,b" strings once, so a stroke can take any alpha. The deepest water is the page's
// canvas colour in both themes, which is what lets the sheet sit on the page with no seam.
import type { Theme } from "./scene";

/** OKLCH to sRGB, 0..255 (gamut-clipped by clamping) */
export function oklch(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const enc = (v: number): number => {
    v = Math.min(1, Math.max(0, v));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
  };
  return [enc(lin[0]!), enc(lin[1]!), enc(lin[2]!)];
}
const rgb = (c: [number, number, number]): string => c.join(",");

export interface Palette {
  dark: boolean;
  /** page canvas, deepest water */
  canvas: [number, number, number];
  deep: [number, number, number];
  shallow: [number, number, number];
  shore: [number, number, number];
  land: [number, number, number];
  land2: [number, number, number];
  /** line ink, "r,g,b" */
  ink: string;
  /** bright ink for the coast and harbour works */
  bright: string;
  /** the one accent */
  green: string;
  greenLine: string;
  /** hull fill and the label pill */
  hull: string;
  pill: string;
  pillText: string;
  pillDim: string;
  /** headline-side text on the chart (names) */
  name: string;
  /** vignette and scrim colour */
  veil: string;
  /** how strong the vignette is */
  vignette: number;
  scrimA: number;
  contourA: number;
  grain: number;
}

const make = (dark: boolean): Palette => {
  if (dark) {
    const canvas = oklch(0.18, 0.014, 255);
    return {
      dark,
      canvas,
      deep: canvas,
      shallow: oklch(0.34, 0.052, 205),
      shore: oklch(0.43, 0.06, 200),
      land: oklch(0.25, 0.026, 215),
      land2: oklch(0.3, 0.03, 212),
      ink: rgb(oklch(0.84, 0.045, 205)),
      bright: rgb(oklch(0.93, 0.03, 195)),
      green: rgb(oklch(0.81, 0.17, 152)),
      greenLine: rgb(oklch(0.86, 0.15, 152)),
      hull: rgb(oklch(0.2, 0.02, 225)),
      pill: rgb(oklch(0.17, 0.018, 235)),
      pillText: rgb(oklch(0.95, 0.01, 200)),
      pillDim: rgb(oklch(0.7, 0.025, 210)),
      name: rgb(oklch(0.93, 0.02, 195)),
      veil: rgb(canvas),
      vignette: 0.5,
      scrimA: 0.62,
      contourA: 1,
      grain: 14,
    };
  }
  const canvas = oklch(0.965, 0, 0);
  return {
    dark,
    canvas,
    deep: canvas,
    shallow: oklch(0.86, 0.045, 218),
    shore: oklch(0.8, 0.06, 215),
    land: oklch(0.985, 0.006, 95),
    land2: oklch(0.955, 0.012, 95),
    ink: rgb(oklch(0.42, 0.06, 225)),
    bright: rgb(oklch(0.3, 0.05, 230)),
    green: rgb(oklch(0.56, 0.16, 152)),
    greenLine: rgb(oklch(0.5, 0.15, 152)),
    hull: rgb(oklch(0.985, 0.004, 95)),
    pill: rgb(oklch(0.99, 0.002, 95)),
    pillText: rgb(oklch(0.24, 0.02, 235)),
    pillDim: rgb(oklch(0.46, 0.03, 225)),
    name: rgb(oklch(0.3, 0.05, 230)),
    veil: rgb(canvas),
    vignette: 0.0,
    scrimA: 0.7,
    contourA: 1.15,
    grain: 9,
  };
};
const cache: Partial<Record<Theme, Palette>> = {};
export const palette = (t: Theme): Palette => (cache[t] ??= make(t === "dark"));
