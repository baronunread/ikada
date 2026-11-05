/** Real-time durations in ms, mirrored from tokens/tokens.ts for the playground's slow-motion control. */
import { springDuration } from "../src/lib/spring";
import { motion } from "../src/tokens.generated";

const durations = (): [string, number][] => [
  ...Object.entries(motion.duration).map(([name, ms]): [string, number] => [`--sb-duration-${name}`, ms]),
  ...Object.entries(motion.spring).map(([name, s]): [string, number] => [
    `--sb-duration-spring-${name}`,
    springDuration(s.seconds),
  ]),
];

/** Scales every duration token (springs included) on <html> by `factor` (1 restores the stylesheet values) and mirrors it in --sb-slow. */
export function setSpeed(factor: number): void {
  const root = document.documentElement;
  for (const [name, ms] of durations()) {
    if (factor === 1) root.style.removeProperty(name);
    else root.style.setProperty(name, `${ms * factor}ms`);
  }
  root.style.setProperty("--sb-slow", String(factor));
}

/** Simulates prefers-reduced-motion with data-motion="reduce": no movement, springs become a plain ease-out, fades stay. */
export function setReduced(reduced: boolean): void {
  const root = document.documentElement;
  if (reduced) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
}
