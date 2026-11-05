/**
 * A damped spring as a CSS `linear()` easing, described the way Apple's HIG does: a perceived
 * `seconds` and a `bounce` (0 is critically damped, 0.25 overshoots once). The token build
 * samples the three ikada springs into `--sb-spring-smooth|snappy|bob` in theme.css, so the
 * browser runs them on the compositor and an interrupted spring needs no JavaScript.
 *
 * Maths: natural frequency w0 = 2π / seconds, damping ratio ζ = 1 − bounce. The curve runs for
 * `SETTLE` × seconds, by which point every ikada spring is within 0.1% of rest, so nothing snaps
 * at the end; use `springDuration` for the matching CSS duration.
 */
export const SETTLE = 1.5;

/** CSS duration in ms for a spring sampled by `springLinear`. */
export const springDuration = (seconds: number): number => Math.round(seconds * SETTLE * 1000);

export function springLinear(seconds: number, bounce = 0, steps = 40): string {
  const w0 = (2 * Math.PI) / seconds;
  const zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  const at = (t: number): number => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = i === steps ? 1 : at((i / steps) * seconds * SETTLE);
    // Shortest form (no trailing zeros), so formatters leave the generated CSS alone.
    stops.push(i === 0 ? "0" : `${Number(v.toFixed(4))} ${Number(((i / steps) * 100).toFixed(1))}%`);
  }
  return `linear(${stops.join(", ")})`;
}

/** The highest point a spring reaches, as a fraction of its travel (1 means no overshoot). */
export function springPeak(seconds: number, bounce = 0, steps = 200): number {
  const values = springLinear(seconds, bounce, steps)
    .slice(7, -1)
    .split(", ")
    .map((stop) => Number(stop.split(" ")[0]));
  return Math.max(...values);
}
