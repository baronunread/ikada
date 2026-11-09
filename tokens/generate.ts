import { springDuration, springLinear } from "../src/lib/spring";
import { contrast } from "./color";
import { minRatio, pairs } from "./pairs";
import type { PairKind } from "./pairs";
import {
  border,
  breakpoints,
  colorNames,
  dark,
  density,
  fonts,
  light,
  motion,
  radius,
  shadow,
  spacing,
  typeScale,
  zIndex,
} from "./tokens";
import type { ColorTheme } from "./tokens";

const px = (n: number): string => `${n}px`;
const rem = (n: number): string => `${Number((n / 16).toFixed(4))}rem`;
const vars = (entries: [string, string][]): string => entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");

const colorVars = (theme: ColorTheme): string => vars(colorNames.map((n) => [`--sb-${n}`, theme[n]]));
const shadowVars = (mode: "dark" | "light"): string =>
  vars(Object.entries(shadow[mode]).map(([k, v]) => [`--sb-shadow-${k}`, v]));

const ms = (n: number): string => `${n}ms`;

/** The spring easings and durations as custom properties; `reduced` gives the reduced-motion substitutes. */
export function springProperties(reduced = false): Record<string, string> {
  return Object.fromEntries(
    Object.entries(motion.spring).flatMap(([k, v]): [string, string][] => [
      [`--sb-spring-${k}`, reduced ? motion.reducedSpring.easing : springLinear(v.seconds, v.bounce)],
      [`--sb-duration-spring-${k}`, ms(reduced ? motion.reducedSpring.duration : springDuration(v.seconds))],
    ]),
  );
}

/** Pixel offsets that collapse with --sb-move. */
export const offsetProperties = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(motion.offset).map(([k, v]) => [`--sb-offset-${k}`, `calc(${v}px * var(--sb-move))`]),
  );

/** What reduced motion (the media query or data-motion="reduce") sets on :root. */
export const reducedMotionProperties = (): Record<string, string> => ({ "--sb-move": "0", ...springProperties(true) });

/** Registered custom properties, so a keyframe can animate the focus wake's spread and alpha. */
export const motionAtProperties: Record<string, Record<string, string>> = {
  "--sb-wake": { syntax: '"<length>"', inherits: "false", "initial-value": "0px" },
  "--sb-wake-alpha": { syntax: '"<percentage>"', inherits: "false", "initial-value": "0%" },
};

/** One-shot effects that are never interrupted. Everything else is a transition. */
export const motionKeyframes: Record<string, { note: string; frames: Record<string, Record<string, string>> }> = {
  "sb-wake": {
    note: "The focus wake: a halo ripples out once from the 2px ring.",
    frames: {
      from: { "--sb-wake": "4px", "--sb-wake-alpha": "30%" },
      to: { "--sb-wake": "calc(4px + var(--sb-offset-wake))", "--sb-wake-alpha": "0%" },
    },
  },
  "sb-bob": {
    note: "A control filling (checkbox) or a thing landing: dips, then springs back past 1 once.",
    frames: { from: { scale: "calc(1 - 0.12 * var(--sb-move))" }, to: { scale: "1" } },
  },
  "sb-sprout": {
    note: "Success and creation: the glyph grows up from its base...",
    frames: {
      from: { opacity: "0.4", scale: "calc(1 - 0.6 * var(--sb-move))", translate: "0 calc(2px * var(--sb-move))" },
      to: { opacity: "1", scale: "1", translate: "0 0" },
    },
  },
  "sb-sprout-ring": {
    note: "...and sends one ring out.",
    frames: {
      "0%": { opacity: "0", scale: "0.6" },
      "20%": { opacity: "0.6" },
      "100%": { opacity: "0", scale: "calc(1 + 1.3 * var(--sb-move))" },
    },
  },
  "sb-breathe": {
    note: "Skeletons breathe (a fade, so it stays under reduced motion); siblings stagger by 120ms.",
    frames: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
  },
};

const block = (selector: string, decls: Record<string, string>, indent = ""): string =>
  `${indent}${selector} {\n${Object.entries(decls)
    .map(([k, v]) => `${indent}  ${k}: ${v};`)
    .join("\n")}\n${indent}}`;

function renderMotionPrimitives(): string {
  const props = Object.entries(motionAtProperties).map(([name, d]) => block(`@property ${name}`, d));
  const frames = Object.entries(motionKeyframes).map(
    ([name, k]) =>
      `/* ${k.note} */\n@keyframes ${name} {\n${Object.entries(k.frames)
        .map(([at, d]) => block(at, d, "  "))
        .join("\n")}\n}`,
  );
  return `/* Shared motion primitives (see DESIGN.md, Motion). */\n${[...props, ...frames].join("\n")}`;
}

const reducedVars = (): string => vars(Object.entries(reducedMotionProperties()));

export function renderThemeCss(): string {
  // `text-sb-*` is what the components use, so a host's own `text-sm` stays Tailwind's. The plain
  // `--text-*` copies keep 0.1.x apps (which wrote `text-sm` against ikada's scale) rendering the same.
  const scale = (prefix: string): string[] =>
    Object.entries(typeScale).map(([name, s]) =>
      vars([
        [`--text-${prefix}${name}`, rem(s.size)],
        [`--text-${prefix}${name}--line-height`, rem(s.line)],
        [`--text-${prefix}${name}--letter-spacing`, `${s.tracking}em`],
        [`--text-${prefix}${name}--font-weight`, String(s.weight)],
      ]),
    );
  const text = [...scale("sb-"), ...scale("")];
  return `/* GENERATED by scripts/build-tokens.ts from tokens/tokens.ts. Do not edit. */

/* Light is the default and dark is a \`dark\` class on <html> (shadcn and next-themes
   attribute="class"). data-theme="dark|light" still works as a deprecated alias for one release. */
@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));

:root,
[data-theme="light"] {
  color-scheme: light;
${colorVars(light)}
${shadowVars("light")}
}

.dark,
[data-theme="dark"] {
  color-scheme: dark;
${colorVars(dark)}
${shadowVars("dark")}
}

:root {
  /* 1 lets layers move (scale, slide); 0 under reduced motion, where only fades stay. */
  --sb-move: 1;
${vars(Object.entries(motion.duration).map(([k, v]) => [`--sb-duration-${k}`, ms(v)]))}
${vars(Object.entries(springProperties()))}
${vars(Object.entries(offsetProperties()))}
${vars(Object.entries(motion.scale).map(([k, v]) => [`--sb-scale-${k}`, `calc(1 - ${Number((1 - v).toFixed(2))} * var(--sb-move))`]))}
${vars(Object.entries(zIndex).map(([k, v]) => [`--sb-z-${k}`, String(v)]))}
}

/* Density: set data-density on any ancestor. Type size never changes. */
:root,
[data-density="comfortable"] {
${vars([
  ["--sb-control-h", px(density.comfortable.control)],
  ["--sb-control-h-sm", px(density.comfortable.controlSm)],
  ["--sb-row-h", px(density.comfortable.row)],
])}
}
[data-density="compact"] {
${vars([
  ["--sb-control-h", px(density.compact.control)],
  ["--sb-control-h-sm", px(density.compact.controlSm)],
  ["--sb-row-h", px(density.compact.row)],
])}
}

/* Reduced motion substitutes, never removes: the scale and offset tokens collapse (no scale,
   no slide), every spring becomes a short ease-out with no overshoot, and fades stay.
   data-motion="reduce" on <html> opts in from an app setting. */
@media (prefers-reduced-motion: reduce) {
  :root {
${reducedVars()}
  }
}
:root[data-motion="reduce"] {
${reducedVars()}
}

${renderMotionPrimitives()}

@theme {
${vars([
  ["--font-sans", fonts.sans],
  ["--font-mono", fonts.mono],
  ["--spacing", rem(spacing.base)],
  ...Object.entries(radius).map(([k, v]): [string, string] => [`--radius-${k}`, k === "full" ? "9999px" : rem(v.px)]),
  ...Object.entries(breakpoints).map(([k, v]): [string, string] => [`--breakpoint-${k}`, `${v.rem}rem`]),
  ...Object.entries(motion.easing).map(([k, v]): [string, string] => [`--ease-${k}`, v]),
])}
${text.join("\n")}
}

@theme inline {
${vars(colorNames.map((n) => [`--color-${n}`, `var(--sb-${n})`]))}
${vars(Object.keys(shadow.dark).map((k) => [`--shadow-${k}`, `var(--sb-shadow-${k})`]))}
${vars(Object.keys(motion.spring).map((k) => [`--ease-spring-${k}`, `var(--sb-spring-${k})`]))}
}

@layer base {
  :root {
    font-family: var(--font-sans);
    font-synthesis: none;
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    scrollbar-gutter: stable;
  }
  h1,
  h2,
  h3 {
    text-wrap: balance;
  }
  p {
    text-wrap: pretty;
  }
  code,
  kbd,
  samp,
  pre {
    font-family: var(--font-mono);
    font-feature-settings: "zero";
  }
  *,
  ::after,
  ::before,
  ::backdrop {
    border-color: var(--sb-hairline);
  }
  /* Scope for TanStack Charts: its palette and tooltip read these variables. */
  .sb-chart {
    --ts-chart-1: var(--sb-chart-requests);
    --ts-chart-2: var(--sb-chart-series);
    --ts-chart-3: var(--sb-chart-4xx);
    --ts-chart-4: var(--sb-chart-errors);
    --ts-chart-5: var(--sb-chart-3xx);
    --ts-chart-6: var(--sb-chart-other);
    --ts-chart-tooltip-background: var(--sb-raised);
    --ts-chart-tooltip-color: var(--sb-fg);
    --ts-chart-tooltip-border: 0;
    --ts-chart-tooltip-border-radius: 10px;
    --ts-chart-tooltip-shadow: var(--sb-shadow-float);
    --ts-chart-tooltip-padding: 8px 10px;
    --ts-chart-tooltip-font: 500 12px/1.4 var(--font-sans);
    font-variant-numeric: tabular-nums;
  }
  .sb-chart .ts-chart-tooltip {
    z-index: var(--sb-z-tooltip);
  }
  ::selection {
    background: var(--sb-brand);
    color: var(--sb-on-brand);
  }
  :focus-visible {
    outline: 2px solid var(--sb-focus);
    outline-offset: 2px;
  }
}
`;
}

export function renderTokensTs(): string {
  const data = {
    colors: { dark, light },
    colorNames,
    typeScale,
    fonts,
    spacing,
    radius,
    border,
    shadow,
    motion,
    zIndex,
    breakpoints,
    density,
  };
  const body = Object.entries(data)
    .map(([k, v]) => `export const ${k} = ${JSON.stringify(v, null, 2)} as const;`)
    .join("\n\n");
  return `// GENERATED by scripts/build-tokens.ts from tokens/tokens.ts. Do not edit.

/** ikada design tokens as data: colours, type, spacing, radii, shadows, motion and springs, layers. */
${body}

export type ColorToken = (typeof colorNames)[number];

/** \`var(--sb-<name>)\` reference for use in inline styles and charts. */
export const colorVar = (name: ColorToken): string => \`var(--sb-\${name})\`;
`;
}

// ---------------------------------------------------------------- DESIGN.md

const table = (head: string[], rows: string[][]): string =>
  [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => " --- ").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

const ratio = (a: string, b: string): string => `${contrast(a, b).toFixed(2)}:1`;
const status = (kind: PairKind, a: string, b: string): string => (contrast(a, b) >= minRatio[kind] ? "pass" : "FAIL");

const lightShadow: Record<string, string> = shadow.light;

const decorative = [
  ["hairline", "canvas"],
  ["hairline", "surface"],
  ["hairline-strong", "surface"],
  ["chart-grid", "surface"],
] as const;

export const docRegions = {
  palette: () =>
    table(
      ["Token", "Tailwind utility", "Dark", "Light"],
      colorNames.map((n) => [
        `\`${n}\``,
        `\`bg-${n}\` \`text-${n}\` \`border-${n}\``,
        `\`${dark[n]}\``,
        `\`${light[n]}\``,
      ]),
    ),
  contrast: () =>
    table(
      ["Foreground", "Background", "Needs", "Dark", "Light", "Used for"],
      pairs.map((p) => [
        `\`${p.fg}\``,
        `\`${p.bg}\``,
        `${minRatio[p.kind]}:1 (${p.kind})`,
        `${ratio(dark[p.fg], dark[p.bg])} ${status(p.kind, dark[p.fg], dark[p.bg])}`,
        `${ratio(light[p.fg], light[p.bg])} ${status(p.kind, light[p.fg], light[p.bg])}`,
        p.note,
      ]),
    ),
  decorative: () =>
    table(
      ["Hairline", "Against", "Dark", "Light"],
      decorative.map(([fg, bg]) => [`\`${fg}\``, `\`${bg}\``, ratio(dark[fg], dark[bg]), ratio(light[fg], light[bg])]),
    ),
  type: () =>
    table(
      ["Step", "Size / line", "Weight", "Tracking", "Utility", "Use"],
      Object.entries(typeScale).map(([k, s]) => [
        `\`${k}\``,
        `${s.size}px / ${s.line}px`,
        String(s.weight),
        `${s.tracking}em`,
        `\`text-sb-${k}\``,
        s.use,
      ]),
    ),
  spacing: () =>
    table(
      ["Step", "Utility example", "Pixels"],
      spacing.steps.map((s) => [String(s), `\`p-${s}\` \`gap-${s}\``, px(s * spacing.base)]),
    ),
  radius: () =>
    table(
      ["Token", "Utility", "Size", "Use"],
      Object.entries(radius).map(([k, v]) => [`\`${k}\``, `\`rounded-${k}\``, k === "full" ? "pill" : px(v.px), v.use]),
    ),
  border: () =>
    table(
      ["Token", "Width", "Use"],
      Object.entries(border).map(([k, v]) => [`\`${k}\``, px(v.px), v.use]),
    ),
  shadow: () =>
    table(
      ["Token", "Utility", "Dark", "Light"],
      Object.entries(shadow.dark).map(([k, darkValue]) => [
        `\`${k}\``,
        `\`shadow-${k}\``,
        `\`${darkValue}\``,
        `\`${lightShadow[k]}\``,
      ]),
    ),
  motion: () =>
    table(
      ["Token", "Value", "Reduced motion"],
      [
        ...Object.entries(motion.duration).map(([k, v]) => [
          `\`--sb-duration-${k}\``,
          `${v}ms`,
          "unchanged (fade stays)",
        ]),
        ...Object.entries(motion.easing).map(([k, v]) => [`\`ease-${k}\``, `\`${v}\``, "unchanged"]),
        ...Object.entries(motion.spring).map(([k, v]) => [
          `\`--sb-spring-${k}\` (\`ease-spring-${k}\`) with \`--sb-duration-spring-${k}\``,
          `${v.seconds}s, bounce ${v.bounce}: ${v.use}`,
          `${motion.reducedSpring.duration}ms ease-out, no overshoot`,
        ]),
        ...Object.entries(motion.offset).map(([k, v]) => [`\`--sb-offset-${k}\``, `${v}px`, "0 (no movement)"]),
        ...Object.entries(motion.scale).map(([k, v]) => [`\`--sb-scale-${k}\``, String(v), "1 (no scale)"]),
      ],
    ),
  zindex: () =>
    table(
      ["Layer", "Variable", "Value"],
      Object.entries(zIndex).map(([k, v]) => [k, `\`--sb-z-${k}\``, String(v)]),
    ),
  breakpoints: () =>
    table(
      ["Name", "Min width", "Use"],
      Object.entries(breakpoints).map(([k, v]) => [`\`${k}:\``, `${v.rem}rem (${v.rem * 16}px)`, v.use]),
    ),
  density: () =>
    table(
      ["Density", "Control", "Small control", "Table row"],
      Object.entries(density).map(([k, v]) => [`\`${k}\``, px(v.control), px(v.controlSm), px(v.row)]),
    ),
} satisfies Record<string, () => string>;

export function applyDocRegions(markdown: string): string {
  let out = markdown;
  for (const [name, render] of Object.entries(docRegions)) {
    const start = `<!-- tokens:${name}:start -->`;
    const end = `<!-- tokens:${name}:end -->`;
    const a = out.indexOf(start);
    const b = out.indexOf(end);
    if (a < 0 || b < a) throw new Error(`DESIGN.md is missing the ${name} region markers`);
    out = `${out.slice(0, a + start.length)}\n${render()}\n${out.slice(b)}`;
  }
  return out;
}
