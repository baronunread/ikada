/**
 * Sproutboat design tokens: the single source of truth.
 *
 * `bun run tokens` reads this file and writes
 *   - src/theme.css            (Tailwind v4 @theme plus light and dark variables)
 *   - src/tokens.generated.ts  (the same values as typed TS exports)
 *   - the generated tables inside DESIGN.md
 * Never edit those outputs by hand. `test/tokens.test.ts` fails when they drift
 * from this file, and when a text or UI pair drops below its WCAG ratio.
 *
 * Colors are OKLCH strings, always opaque (the contrast math needs a known
 * backdrop), except `scrim`, which is a translucent overlay and is not paired.
 */

export const colorNames = [
  // Surfaces, light to heavy: canvas (page) < surface (cards) < well (inset) < hover; raised is for floating layers.
  "canvas",
  "surface",
  "well",
  "hover",
  "raised",
  "hairline",
  "hairline-strong",
  "control-edge",
  "focus",
  "fg",
  "fg-muted",
  // Sprout green: primary actions and success only. Focus is neutral (see `focus`).
  "brand",
  "brand-hover",
  "on-brand",
  "brand-fg",
  "brand-soft",
  "brand-dot",
  "warn-fg",
  "warn-soft",
  "warn-dot",
  "danger",
  "danger-hover",
  "on-danger",
  "danger-fg",
  "danger-soft",
  "danger-dot",
  "info-fg",
  "info-soft",
  "info-dot",
  "neutral-fg",
  "neutral-soft",
  "neutral-dot",
  "code-bg",
  "diff-add",
  "diff-del",
  "chart-requests",
  "chart-errors",
  "chart-deploy",
  "chart-grid",
  "chart-2xx",
  "chart-3xx",
  "chart-4xx",
  "chart-5xx",
  "chart-other",
  "chart-series",
  "scrim",
] as const;

export type ColorName = (typeof colorNames)[number];
export type ColorTheme = Record<ColorName, string>;

/**
 * Dark is the default theme: it applies with no `data-theme` attribute.
 * Cool slate graphite (hue 255, chroma 0.014 to 0.02). Accent buttons are a step
 * quieter than the v3 sheet (#67d283): L 0.72 and C 0.12 instead of 0.78 and 0.15.
 */
export const dark = {
  canvas: "oklch(0.18 0.014 255)",
  surface: "oklch(0.23 0.016 255)",
  well: "oklch(0.2 0.015 255)",
  hover: "oklch(0.295 0.018 255)",
  raised: "oklch(0.34 0.02 255)",
  hairline: "oklch(0.3 0.018 255)",
  "hairline-strong": "oklch(0.4 0.02 255)",
  "control-edge": "oklch(0.62 0.02 255)",
  focus: "oklch(0.95 0.01 255)",
  fg: "oklch(0.95 0.01 255)",
  "fg-muted": "oklch(0.76 0.018 255)",
  brand: "oklch(0.72 0.12 152)",
  "brand-hover": "oklch(0.77 0.12 152)",
  "on-brand": "oklch(0.2 0.03 152)",
  "brand-fg": "oklch(0.82 0.13 152)",
  "brand-soft": "oklch(0.31 0.045 152)",
  "brand-dot": "oklch(0.74 0.15 152)",
  "warn-fg": "oklch(0.88 0.1 85)",
  "warn-soft": "oklch(0.35 0.06 80)",
  "warn-dot": "oklch(0.8 0.14 80)",
  danger: "oklch(0.68 0.14 25)",
  "danger-hover": "oklch(0.73 0.13 25)",
  "on-danger": "oklch(0.18 0.04 25)",
  "danger-fg": "oklch(0.85 0.1 25)",
  "danger-soft": "oklch(0.34 0.08 25)",
  "danger-dot": "oklch(0.74 0.16 25)",
  "info-fg": "oklch(0.84 0.1 255)",
  "info-soft": "oklch(0.33 0.07 255)",
  "info-dot": "oklch(0.76 0.13 255)",
  "neutral-fg": "oklch(0.85 0.012 255)",
  "neutral-soft": "oklch(0.33 0.012 255)",
  "neutral-dot": "oklch(0.72 0.012 255)",
  "code-bg": "oklch(0.155 0.012 255)",
  "diff-add": "oklch(0.27 0.05 152)",
  "diff-del": "oklch(0.27 0.06 25)",
  "chart-requests": "oklch(0.76 0.13 255)",
  "chart-errors": "oklch(0.74 0.16 25)",
  "chart-deploy": "oklch(0.83 0.015 255)",
  "chart-grid": "oklch(0.34 0.018 255)",
  "chart-2xx": "oklch(0.76 0.16 152)",
  "chart-3xx": "oklch(0.78 0.1 235)",
  "chart-4xx": "oklch(0.8 0.13 80)",
  "chart-5xx": "oklch(0.74 0.16 25)",
  "chart-other": "oklch(0.72 0.012 255)",
  "chart-series": "oklch(0.76 0.1 300)",
  scrim: "oklch(0.06 0.012 255 / 0.62)",
} satisfies ColorTheme;

/** Light: neutral grey surfaces, near zero chroma. */
export const light = {
  canvas: "oklch(0.965 0 0)",
  surface: "oklch(0.995 0 0)",
  well: "oklch(0.962 0 0)",
  hover: "oklch(0.925 0 0)",
  raised: "oklch(1 0 0)",
  hairline: "oklch(0.9 0 0)",
  "hairline-strong": "oklch(0.82 0 0)",
  "control-edge": "oklch(0.6 0 0)",
  focus: "oklch(0.22 0 0)",
  fg: "oklch(0.22 0 0)",
  "fg-muted": "oklch(0.44 0 0)",
  brand: "oklch(0.47 0.12 152)",
  "brand-hover": "oklch(0.42 0.105 152)",
  "on-brand": "oklch(0.99 0.005 150)",
  "brand-fg": "oklch(0.42 0.11 152)",
  "brand-soft": "oklch(0.94 0.05 150)",
  "brand-dot": "oklch(0.62 0.16 150)",
  "warn-fg": "oklch(0.43 0.09 70)",
  "warn-soft": "oklch(0.95 0.06 85)",
  "warn-dot": "oklch(0.63 0.14 72)",
  danger: "oklch(0.48 0.18 25)",
  "danger-hover": "oklch(0.43 0.18 25)",
  "on-danger": "oklch(1 0 0)",
  "danger-fg": "oklch(0.46 0.18 25)",
  "danger-soft": "oklch(0.95 0.035 25)",
  "danger-dot": "oklch(0.58 0.2 25)",
  "info-fg": "oklch(0.42 0.14 255)",
  "info-soft": "oklch(0.94 0.04 255)",
  "info-dot": "oklch(0.58 0.15 255)",
  "neutral-fg": "oklch(0.42 0 0)",
  "neutral-soft": "oklch(0.93 0 0)",
  "neutral-dot": "oklch(0.55 0 0)",
  "code-bg": "oklch(0.955 0 0)",
  "diff-add": "oklch(0.94 0.05 150)",
  "diff-del": "oklch(0.95 0.04 25)",
  "chart-requests": "oklch(0.55 0.15 255)",
  "chart-errors": "oklch(0.58 0.2 25)",
  "chart-deploy": "oklch(0.4 0 0)",
  "chart-grid": "oklch(0.88 0 0)",
  "chart-2xx": "oklch(0.6 0.16 150)",
  "chart-3xx": "oklch(0.6 0.12 235)",
  "chart-4xx": "oklch(0.62 0.135 75)",
  "chart-5xx": "oklch(0.58 0.2 25)",
  "chart-other": "oklch(0.55 0 0)",
  "chart-series": "oklch(0.55 0.12 300)",
  scrim: "oklch(0.25 0 260 / 0.34)",
} satisfies ColorTheme;

/** Each type step: size and line height in px, weight, tracking in em. */
export interface TypeStep {
  size: number;
  line: number;
  weight: number;
  tracking: number;
  use: string;
}

export const typeScale = {
  xs: { size: 12, line: 16, weight: 500, tracking: 0, use: "Captions, keycaps, dense meta" },
  sm: { size: 13, line: 20, weight: 400, tracking: 0, use: "Labels, helper text, table meta" },
  base: { size: 14, line: 20, weight: 400, tracking: 0, use: "Body, controls, table cells" },
  md: { size: 15, line: 22, weight: 600, tracking: -0.005, use: "Section titles" },
  lg: { size: 18, line: 26, weight: 700, tracking: -0.01, use: "Dialog and panel titles" },
  xl: { size: 24, line: 32, weight: 700, tracking: -0.015, use: "Page titles on small screens" },
  "2xl": { size: 28, line: 36, weight: 700, tracking: -0.02, use: "Page titles" },
  metric: {
    size: 28,
    line: 36,
    weight: 700,
    tracking: -0.02,
    use: "Hero numbers in a metric tile (proportional figures)",
  },
} satisfies Record<string, TypeStep>;

export const fonts = {
  sans: '"Figtree Variable", "Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Tailwind's 4px grid. Named here so the docs and TS agree with `--spacing`. */
export const spacing = {
  base: 4,
  steps: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16],
  layout: { gutter: 16, page: 24, section: 24 },
} as const;

/**
 * Concentric radii: outer = inner + padding. A control is 8. A popover or menu holding
 * 8px items with 4px padding is 12. A well (10) with 4px padding holds 6px rows.
 */
export const radius = {
  xs: { px: 4, use: "Keycaps, icon boxes inside a 8px control (8 - 4)" },
  sm: { px: 6, use: "Rows and segments inside a 10px well (10 - 4)" },
  md: { px: 8, use: "Buttons, inputs, selects, menu items, tabs" },
  lg: { px: 10, use: "Wells, tab lists, code blocks" },
  xl: { px: 12, use: "Cards, popovers, menus, dialogs, toasts (8 + 4)" },
  "2xl": { px: 14, use: "Command palette (8 + 6)" },
  full: { px: 9999, use: "Badges, status pills, switch" },
} as const;

export const border = {
  hairline: { px: 1, use: "Dividers and table rules only; surfaces separate by tone and shadow" },
  focus: { px: 2, use: "Focus ring (neutral ink)" },
} as const;

/**
 * Afloat surfaces: a hairline ring inside the shadow (never a border) plus a negative-spread
 * cast, so a card floats just above the canvas. Hover lifts the cast (`*-hover`); a press
 * presses in (`*-pressed`). `tray` is recessed water: segmented controls and tab lists sit
 * in one, with a raised `pill` (the pebble) riding on top. Dark trades the cast for a top
 * highlight and a deep black cast. `field` is the control edge drawn as an inset ring (3:1).
 */
export const shadow = {
  dark: {
    card: "0 0 0 1px oklch(1 0 0 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 10px 24px -14px oklch(0 0 0 / 0.5)",
    "card-hover":
      "0 0 0 1px oklch(1 0 0 / 0.09), inset 0 1px 0 oklch(1 0 0 / 0.05), 0 18px 32px -14px oklch(0 0 0 / 0.6)",
    button: "inset 0 0 0 1px oklch(1 0 0 / 0.09), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 1px 2px oklch(0 0 0 / 0.3)",
    "button-hover":
      "inset 0 0 0 1px oklch(1 0 0 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.05), 0 3px 8px -2px oklch(0 0 0 / 0.45)",
    "button-pressed": "inset 0 0 0 1px oklch(1 0 0 / 0.1), inset 0 2px 3px oklch(0 0 0 / 0.3)",
    primary:
      "inset 0 1px 0 oklch(1 0 0 / 0.35), 0 1px 2px oklch(0 0 0 / 0.4), 0 6px 14px -6px oklch(0.6 0.12 152 / 0.4)",
    "primary-hover":
      "inset 0 1px 0 oklch(1 0 0 / 0.4), 0 2px 4px oklch(0 0 0 / 0.4), 0 10px 20px -6px oklch(0.6 0.12 152 / 0.5)",
    "primary-pressed": "inset 0 2px 3px oklch(0.2 0.06 152 / 0.45)",
    field: "inset 0 0 0 1px var(--sb-control-edge)",
    "field-hover": "inset 0 0 0 1px var(--sb-fg-muted)",
    tray: "inset 0 1px 2px oklch(0 0 0 / 0.35), inset 0 0 0 1px oklch(1 0 0 / 0.04)",
    pill: "0 0 0 1px oklch(1 0 0 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 3px oklch(0 0 0 / 0.4)",
    float:
      "0 0 0 1px oklch(1 0 0 / 0.11), inset 0 1px 0 oklch(1 0 0 / 0.08), 0 2px 4px oklch(0 0 0 / 0.35), 0 18px 44px -6px oklch(0 0 0 / 0.65)",
    dialog:
      "0 0 0 1px oklch(1 0 0 / 0.11), inset 0 1px 0 oklch(1 0 0 / 0.08), 0 4px 8px oklch(0 0 0 / 0.35), 0 28px 72px -8px oklch(0 0 0 / 0.75)",
  },
  light: {
    card: "0 0 0 1px oklch(0.22 0 0 / 0.06), 0 1px 2px oklch(0.3 0 0 / 0.05), 0 10px 24px -14px oklch(0.3 0 0 / 0.18)",
    "card-hover":
      "0 0 0 1px oklch(0.22 0 0 / 0.08), 0 2px 4px oklch(0.3 0 0 / 0.06), 0 18px 32px -14px oklch(0.3 0 0 / 0.26)",
    button: "inset 0 0 0 1px oklch(0.22 0 0 / 0.09), 0 1px 2px oklch(0.3 0 0 / 0.06)",
    "button-hover": "inset 0 0 0 1px oklch(0.22 0 0 / 0.11), 0 3px 8px -2px oklch(0.3 0 0 / 0.14)",
    "button-pressed": "inset 0 0 0 1px oklch(0.22 0 0 / 0.12), inset 0 2px 3px oklch(0.3 0 0 / 0.08)",
    primary:
      "inset 0 1px 0 oklch(1 0 0 / 0.22), 0 1px 2px oklch(0.3 0.08 152 / 0.3), 0 6px 14px -6px oklch(0.3 0.1 152 / 0.45)",
    "primary-hover":
      "inset 0 1px 0 oklch(1 0 0 / 0.26), 0 2px 4px oklch(0.3 0.08 152 / 0.3), 0 10px 20px -6px oklch(0.3 0.1 152 / 0.5)",
    "primary-pressed": "inset 0 2px 3px oklch(0.2 0.06 152 / 0.3)",
    field: "inset 0 0 0 1px var(--sb-control-edge)",
    "field-hover": "inset 0 0 0 1px var(--sb-fg-muted)",
    tray: "inset 0 1px 2px oklch(0.3 0 0 / 0.08), inset 0 0 0 1px oklch(0.22 0 0 / 0.04)",
    pill: "0 0 0 1px oklch(0.22 0 0 / 0.07), 0 1px 2px oklch(0.3 0 0 / 0.1), 0 4px 8px -4px oklch(0.3 0 0 / 0.16)",
    float:
      "0 0 0 1px oklch(0.22 0 0 / 0.08), 0 2px 4px -1px oklch(0.3 0 0 / 0.1), 0 12px 28px -8px oklch(0.3 0 0 / 0.22), 0 24px 48px -16px oklch(0.3 0 0 / 0.22)",
    dialog:
      "0 0 0 1px oklch(0.22 0 0 / 0.08), 0 4px 8px -2px oklch(0.3 0 0 / 0.12), 0 24px 48px -12px oklch(0.3 0 0 / 0.28), 0 48px 96px -24px oklch(0.3 0 0 / 0.3)",
  },
} as const;

export interface SpringToken {
  /** Perceived duration in seconds (Apple's `duration`): how long until it looks settled. */
  seconds: number;
  /** 0 is critically damped (no overshoot); 0.25 overshoots once, visibly. */
  bounce: number;
  use: string;
}

/**
 * Motion: Afloat. The raft takes your weight. A press settles 1px down and 3% smaller in 90ms
 * (ease-out); the release returns on `bob`, which overshoots once. Nothing else bounces:
 * hover is colour plus a lifted cast shadow, popups and toasts arrive on `snappy` (a hint of
 * overshoot) and leave in 110ms, dialogs arrive on `smooth`. Springs are `duration + bounce`
 * (Apple HIG) sampled to a CSS `linear()` at build time, so they run on the compositor and an
 * interrupted spring needs no JavaScript.
 *
 * Reduced motion substitutes, never removes: `--sb-move` drops to 0 (no scale, no slide), every
 * spring collapses to a 160ms ease-out with no overshoot, and fades and colour changes stay.
 */
export const motion = {
  duration: {
    hover: 120,
    press: 90,
    "tooltip-in": 150,
    "tooltip-out": 100,
    "popup-in": 140,
    "popup-out": 110,
    "dialog-in": 220,
    "dialog-out": 150,
    slide: 250,
    "toast-in": 300,
    "toast-out": 110,
    wake: 520,
  },
  easing: {
    out: "cubic-bezier(0.23, 1, 0.32, 1)",
    "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
    /** Hover colour only. Everything that enters or is pressed uses `out` or a spring. */
    hover: "ease",
  },
  spring: {
    smooth: { seconds: 0.35, bounce: 0, use: "Dialogs and drawers arriving; no overshoot" },
    snappy: {
      seconds: 0.35,
      bounce: 0.15,
      use: "Popups, toasts, the segmented and tab pebble, the switch thumb",
    },
    bob: { seconds: 0.45, bounce: 0.25, use: "Release of a press, a checkbox filling, a success glyph landing" },
  } satisfies Record<string, SpringToken>,
  /** What every spring becomes under reduced motion. */
  reducedSpring: { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  /** Start scale of an entering layer, the pressed scale of a button, and of a swapping icon. Layers never start below 0.96. */
  scale: { popup: 0.96, dialog: 0.96, press: 0.97, icon: 0.25 },
  /** Pixel offsets that also collapse under reduced motion: the press settle, the focus wake spread. */
  offset: { press: 1, wake: 6 },
} as const;

/**
 * Stacking order. Menus sit above the modal layer because they open from inside dialogs and
 * the mobile navigation drawer (a modal); below it they would render under the scrim.
 */
export const zIndex = {
  base: 0,
  sticky: 20,
  overlay: 50,
  modal: 60,
  dropdown: 65,
  popover: 70,
  toast: 80,
  tooltip: 90,
} as const;

export const breakpoints = {
  sm: { rem: 40, use: "Large phones, landscape" },
  md: { rem: 48, use: "Tablets, sidebar becomes a rail" },
  lg: { rem: 64, use: "Laptops, sidebar fully open" },
  xl: { rem: 80, use: "Desktops" },
  "2xl": { rem: 96, use: "Wide screens, content stops growing at 1280px" },
} as const;

/** Density only changes control and row height; type size never changes. */
export const density = {
  comfortable: { control: 36, controlSm: 28, row: 48 },
  compact: { control: 32, controlSm: 24, row: 36 },
} as const;

export type DensityName = keyof typeof density;
