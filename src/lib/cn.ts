/**
 * Class helpers and the shared Afloat primitives: focus ring and wake, press settle and bob,
 * popup motion, field and floating surfaces, the recessed tray and the sliding pebble.
 */
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { typeScale } from "../tokens.generated";

/** tailwind-merge that knows our `text-sb-<step>` sizes (and the plain 0.1.x `text-<step>` ones) are sizes, not colors. */
const steps = Object.keys(typeScale);
export const merge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...steps.map((k) => "sb-" + k), ...steps] }] } },
});

/** Join and de-conflict class names; later arguments win. */
export const cn = (...inputs: ClassValue[]): string => merge(clsx(inputs));

type Variants = Record<string, Record<string, ClassValue>>;

/** Props a `tv` style function takes: one key per variant group plus `className`, which wins. */
export type TvProps<V extends Variants> = {
  [K in keyof V]?: (keyof V[K] & string) | null | undefined;
} & { className?: ClassValue };

/** The variant props of a style function made by `tv`, without `className`: `VariantProps<typeof buttonStyles>`. */
export type VariantProps<F> = F extends (props?: infer P) => string ? Omit<NonNullable<P>, "className"> : never;

/**
 * A small class-variance helper (the part of tailwind-variants ikada used, without its bundled
 * tailwind-merge): `base` plus one class set per chosen variant, merged so `className` wins.
 */
export function tv<const V extends Variants>(config: {
  base?: ClassValue;
  variants: V;
  defaultVariants?: { [K in keyof V]?: keyof V[K] & string };
}): (props?: TvProps<V>) => string {
  return (props = {}) =>
    cn(
      config.base,
      Object.keys(config.variants).map((group) => {
        const chosen = (props as Record<string, unknown>)[group] ?? config.defaultVariants?.[group];
        return chosen == null ? null : config.variants[group]?.[String(chosen)];
      }),
      props.className,
    );
}

/**
 * The focus wake: a halo that ripples 6px out from the ring once, like a wake behind a raft.
 * It rides in Tailwind's ring slot of box-shadow, so it composes with the control's own shadow,
 * and `--sb-wake` / `--sb-wake-alpha` are registered properties animated by `sb-wake` (theme.css).
 * Under reduced motion the halo fades in place without spreading.
 */
export const focusWake = [
  "focus-visible:animate-[sb-wake_var(--sb-duration-wake)_var(--ease-out)]",
  "focus-visible:ring-(length:--sb-wake) focus-visible:ring-[color-mix(in_oklch,var(--sb-focus)_var(--sb-wake-alpha),transparent)]",
].join(" ");

/** Visible focus ring: 2px neutral (near-black or near-white) outline, keyboard focus only, and its wake. */
export const focusRing = [
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  focusWake,
].join(" ");

/** Same ring, drawn inside the box, for controls clipped by a scroller. */
export const focusRingInset =
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/**
 * Enter and exit for menus, selects, popovers and tooltips. They arrive from scale 0.96 at the
 * trigger (Base UI sets --transform-origin) on the snappy spring, fading in over 140ms, and leave
 * in 110ms ease-out. Keyboard-opened layers carry data-sb-instant and skip the animation.
 */
export const popupMotion = [
  "origin-(--transform-origin) [transition:opacity_var(--sb-duration-popup-out)_var(--ease-out),scale_var(--sb-duration-popup-out)_var(--ease-out)]",
  "data-open:[transition:opacity_var(--sb-duration-popup-in)_var(--ease-out),scale_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy)]",
  "data-starting-style:scale-(--sb-scale-popup) data-starting-style:opacity-0",
  "data-ending-style:scale-(--sb-scale-popup) data-ending-style:opacity-0",
  "data-instant:transition-none data-sb-instant:transition-none",
].join(" ");

/** Floating surface used by menus, selects and popovers: a lighter step with a layered shadow. */
export const floatingSurface = "rounded-xl bg-raised text-fg shadow-float outline-none";

/**
 * Afloat press: the control takes your weight. Pressing settles it 1px down and 3% smaller in
 * 90ms ease-out; letting go returns it on the bob spring, which overshoots once. Hover colour and
 * the cast-shadow lift fade over 120ms. Names every property, never "all".
 */
export const pressMotion = [
  "[transition:background-color_var(--sb-duration-hover)_var(--ease-hover),color_var(--sb-duration-hover)_var(--ease-hover),box-shadow_var(--sb-duration-hover)_var(--ease-hover),scale_var(--sb-duration-spring-bob)_var(--sb-spring-bob),translate_var(--sb-duration-spring-bob)_var(--sb-spring-bob)]",
  "active:[transition:background-color_var(--sb-duration-hover)_var(--ease-hover),color_var(--sb-duration-hover)_var(--ease-hover),box-shadow_var(--sb-duration-press)_var(--ease-out),scale_var(--sb-duration-press)_var(--ease-out),translate_var(--sb-duration-press)_var(--ease-out)]",
  "active:scale-(--sb-scale-press) active:translate-y-(--sb-offset-press)",
].join(" ");

/**
 * Recessed tray for segmented controls and tab lists: the well tone with an inset shadow, so the
 * raised pebble inside reads as floating on it.
 */
export const traySurface = "rounded-lg bg-well shadow-tray";

/**
 * The pebble: the one raised element that marks the chosen segment or tab. It slides between
 * items on the snappy spring (CSS variables set from the measured item).
 */
export const pebble = [
  "pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-raised shadow-pill",
  "[transition:translate_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy),width_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy),height_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy)]",
].join(" ");

/**
 * Text field and select trigger: a well with the control edge drawn as an inset
 * ring (3:1), not a border. Invalid swaps the ring to danger.
 */
export const fieldSurface = [
  "rounded-md bg-well text-fg shadow-field",
  "transition-[box-shadow,background-color] duration-(--sb-duration-hover) ease-hover",
  "hover:shadow-field-hover focus-visible:bg-surface",
  "aria-invalid:bg-danger-soft aria-invalid:shadow-[inset_0_0_0_1.5px_var(--sb-danger-dot)]",
  "data-invalid:bg-danger-soft data-invalid:shadow-[inset_0_0_0_1.5px_var(--sb-danger-dot)]",
  "data-disabled:cursor-not-allowed data-disabled:opacity-55",
].join(" ");

/** Touch targets stay at 44px on coarse pointers whatever the density. */
export const coarseTarget = "pointer-coarse:min-h-11";

/** Props of a Base UI part with `className` narrowed to a string (no state callback). */
export type WithClass<T> = Omit<T, "className"> & { className?: string };
