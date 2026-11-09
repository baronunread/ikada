import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Sparkline, TimeseriesChart, timeFormatter, timeTicks } from "../src/charts";
import {
  Badge,
  Button,
  Checkbox,
  SegmentedControl,
  StatusDot,
  Switch,
  deployToast,
  toast,
  ToastProvider,
} from "../src";
import { StatusGlyph } from "../src/components/status-glyph";
import { focusRing, pebble, popupMotion, pressMotion } from "../src/lib/cn";
import { springDuration, springLinear, springPeak } from "../src/lib/spring";
import { motion } from "../src/tokens.generated";

afterEach(cleanup);

const theme = readFileSync(join(import.meta.dir, "../src/theme.css"), "utf8");

describe("springs", () => {
  test("a spring is a linear() curve from 0 that lands exactly on 1", () => {
    const curve = springLinear(0.45, 0.25);
    expect(curve.startsWith("linear(0, ")).toBe(true);
    expect(curve.endsWith(", 1 100%)")).toBe(true);
  });

  test("bounce sets the overshoot: smooth never passes 1, snappy barely, bob once and visibly", () => {
    const { smooth, snappy, bob } = motion.spring;
    expect(springPeak(smooth.seconds, smooth.bounce)).toBeLessThanOrEqual(1);
    expect(springPeak(snappy.seconds, snappy.bounce)).toBeGreaterThan(1);
    expect(springPeak(snappy.seconds, snappy.bounce)).toBeLessThan(1.01);
    expect(springPeak(bob.seconds, bob.bounce)).toBeGreaterThan(1.02);
    expect(springPeak(bob.seconds, bob.bounce)).toBeLessThan(1.05);
  });

  test("the curve has settled before its last stop, so nothing snaps at the end", () => {
    const stops = springLinear(0.45, 0.25).slice(7, -1).split(", ");
    const beforeLast = Number(stops.at(-2)?.split(" ")[0]);
    expect(Math.abs(1 - beforeLast)).toBeLessThan(0.002);
  });

  test("theme.css carries the press, release and popup springs and their durations", () => {
    expect(theme).toContain("--sb-spring-bob: linear(");
    expect(theme).toContain(`--sb-duration-spring-bob: ${springDuration(0.45)}ms;`);
    expect(theme).toContain("--sb-duration-press: 90ms;");
    expect(theme).toContain("--sb-duration-popup-out: 110ms;");
    expect(theme).toContain("--sb-offset-press: calc(1px * var(--sb-move));");
  });

  test("reduced motion collapses every spring to a 160ms ease-out, by media query and by data-motion", () => {
    for (const block of [
      theme.slice(theme.indexOf("@media (prefers-reduced-motion: reduce)")),
      theme.slice(theme.indexOf(':root[data-motion="reduce"]')),
    ]) {
      const scope = block.slice(0, block.indexOf("}"));
      expect(scope).toContain("--sb-move: 0;");
      for (const name of Object.keys(motion.spring)) {
        expect(scope).toContain(`--sb-spring-${name}: cubic-bezier(0.23, 1, 0.32, 1);`);
        expect(scope).toContain(`--sb-duration-spring-${name}: 160ms;`);
      }
    }
  });
});

describe("motion primitives", () => {
  test("press settles 1px down and 3% smaller fast, and releases on the bob spring", () => {
    expect(pressMotion).toContain("active:scale-(--sb-scale-press)");
    expect(pressMotion).toContain("active:translate-y-(--sb-offset-press)");
    expect(pressMotion).toContain("scale_var(--sb-duration-spring-bob)_var(--sb-spring-bob)");
    expect(pressMotion).toContain("active:[transition:");
    expect(pressMotion).toContain("scale_var(--sb-duration-press)_var(--ease-out)");
  });

  test("the focus ring stays a neutral 2px outline and adds the wake", () => {
    expect(focusRing).toContain("focus-visible:outline-2");
    expect(focusRing).toContain("focus-visible:outline-focus");
    expect(focusRing).toContain("focus-visible:animate-[sb-wake_");
    expect(theme).toContain("@keyframes sb-wake");
    expect(theme).toContain("@property --sb-wake");
  });

  test("popups arrive on the snappy spring and leave on a plain ease-out", () => {
    expect(popupMotion).toContain("data-open:[transition:");
    expect(popupMotion).toContain("scale_var(--sb-duration-spring-snappy)_var(--sb-spring-snappy)");
    expect(popupMotion).toContain("scale_var(--sb-duration-popup-out)_var(--ease-out)");
  });

  test("primitives are whole class strings Tailwind can find in the source", () => {
    const cn = readFileSync(join(import.meta.dir, "../src/lib/cn.ts"), "utf8");
    // An interpolated class list is invisible to Tailwind's scanner; the rule would never be generated.
    expect(cn).not.toMatch(/`[^`]*\$\{[^`]*`/);
    expect(pebble).toContain("--sb-spring-snappy");
  });
});

describe("Button", () => {
  test("hover lifts the cast shadow and a press presses it in", () => {
    render(
      <>
        <Button variant="primary">Deploy</Button>
        <Button>Cancel</Button>
      </>,
    );
    const primary = screen.getByRole("button", { name: "Deploy" });
    expect(primary.className).toContain("hover:shadow-primary-hover");
    expect(primary.className).toContain("active:shadow-primary-pressed");
    expect(screen.getByRole("button", { name: "Cancel" }).className).toContain("hover:shadow-button-hover");
  });
});

describe("Checkbox", () => {
  test("bobs once when it fills, not when it mounts checked, and not when it empties", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Checkbox label="Fresh" />
        <Checkbox label="Already" defaultChecked />
      </>,
    );
    const fresh = screen.getByRole("checkbox", { name: "Fresh" });
    expect(fresh.hasAttribute("data-sb-bob")).toBe(false);
    expect(screen.getByRole("checkbox", { name: "Already" }).hasAttribute("data-sb-bob")).toBe(false);
    await user.click(fresh);
    expect(fresh.getAttribute("aria-checked")).toBe("true");
    expect(fresh.hasAttribute("data-sb-bob")).toBe(true);
    // The animation ending clears it so the next fill bobs again.
    const end = new Event("animationend", { bubbles: true }) as Event & { animationName: string };
    Object.defineProperty(end, "animationName", { value: "sb-bob" });
    act(() => {
      fresh.dispatchEvent(end);
    });
    expect(fresh.hasAttribute("data-sb-bob")).toBe(false);
    await user.click(fresh);
    expect(fresh.hasAttribute("data-sb-bob")).toBe(false);
  });

  test("still calls the caller's onCheckedChange", async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    render(<Checkbox label="Tell me" onCheckedChange={(c) => seen.push(c)} />);
    await user.click(screen.getByRole("checkbox", { name: "Tell me" }));
    expect(seen).toEqual([true]);
  });

  test("checked is a solid brand fill and unchecked keeps the 3:1 control edge", () => {
    render(<Checkbox label="Edge" />);
    const box = screen.getByRole("checkbox", { name: "Edge" });
    expect(box.className).toContain("data-checked:bg-brand");
    expect(box.className).toContain("var(--sb-control-edge)");
  });
});

describe("Switch", () => {
  test("the thumb squishes toward its travel while pressed, and not when disabled", () => {
    render(<Switch label="Auto-promote" />);
    const root = screen.getByRole("switch", { name: "Auto-promote" });
    expect(root.className).toContain("[&:active:not([data-disabled])]:[--sb-squish:1]");
    const thumb = root.firstElementChild as HTMLElement;
    expect(thumb.className).toContain("origin-left");
    expect(thumb.className).toContain("data-checked:origin-right");
    expect(thumb.className).toContain("var(--sb-spring-snappy)");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "1h", label: "1h" },
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ] as const;

  function Range() {
    const [value, setValue] = useState<string>("24h");
    return <SegmentedControl aria-label="Range" options={options} value={value} onValueChange={setValue} />;
  }

  test("without layout (server, tests) the pressed segment paints itself and no pebble renders", () => {
    render(<Range />);
    expect(document.querySelector("[data-sb-pebble]")).toBeNull();
    expect(screen.getByRole("button", { name: "24h" }).hasAttribute("data-pressed")).toBe(true);
  });

  test("with layout one pebble sits under the pressed segment and follows the choice", async () => {
    const proto = HTMLElement.prototype;
    const saved = ["offsetLeft", "offsetTop", "offsetWidth", "offsetHeight"].map(
      (k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const,
    );
    const index = (el: HTMLElement) =>
      Array.from(el.parentElement?.querySelectorAll("button") ?? []).indexOf(el as HTMLButtonElement);
    Object.defineProperty(proto, "offsetWidth", { configurable: true, get: () => 40 });
    Object.defineProperty(proto, "offsetHeight", { configurable: true, get: () => 28 });
    Object.defineProperty(proto, "offsetTop", { configurable: true, get: () => 2 });
    Object.defineProperty(proto, "offsetLeft", {
      configurable: true,
      get(this: HTMLElement) {
        return 2 + Math.max(0, index(this)) * 42;
      },
    });
    try {
      const user = userEvent.setup();
      render(<Range />);
      const stone = document.querySelector<HTMLElement>("[data-sb-pebble]");
      expect(stone).not.toBeNull();
      expect(stone?.style.translate).toBe("44px 2px");
      expect(stone?.style.width).toBe("40px");
      expect(screen.getByRole("group", { name: "Range" }).hasAttribute("data-pebble")).toBe(true);
      await user.click(screen.getByRole("button", { name: "7d" }));
      expect(document.querySelector<HTMLElement>("[data-sb-pebble]")?.style.translate).toBe("86px 2px");
      expect(document.querySelectorAll("[data-sb-pebble]")).toHaveLength(1);
    } finally {
      for (const [k, d] of saved) if (d) Object.defineProperty(proto, k, d);
    }
  });
});

describe("sprouting success glyph", () => {
  test("only success sprouts", () => {
    const { container } = render(
      <>
        <StatusGlyph tone="success" sprout />
        <StatusGlyph tone="danger" sprout />
      </>,
    );
    const [ok, bad] = container.querySelectorAll("[data-glyph]");
    expect(ok?.hasAttribute("data-sprout")).toBe(true);
    expect(ok?.className).toContain("animate-[sb-sprout_");
    expect(bad?.hasAttribute("data-sprout")).toBe(false);
  });

  test("Badge and StatusDot pass it through for something just created", () => {
    const { container } = render(
      <>
        <Badge tone="success" dot sprout>
          checkout-edge
        </Badge>
        <StatusDot tone="success" label="Deployed" sprout />
      </>,
    );
    expect(container.querySelectorAll("[data-sprout]")).toHaveLength(2);
  });

  test("a success toast sprouts as it lands; a busy one does not", async () => {
    render(<ToastProvider />);
    act(() => {
      toast.add({ tone: "success", title: "Domain added" });
    });
    const glyph = await screen
      .findByText("Domain added")
      .then(() => document.querySelector("[data-sb-toast] [data-glyph]"));
    expect(glyph?.getAttribute("data-glyph")).toBe("success");
    expect(glyph?.hasAttribute("data-sprout")).toBe(true);
    act(() => toast.close());
    const d = deployToast({ name: "checkout-edge v48" });
    act(() => d.uploaded());
    await screen.findByText("Uploaded");
    const glyphs = () => Array.from(document.querySelectorAll("[data-sb-toast]:not([data-ending-style]) [data-glyph]"));
    const busy = glyphs().filter((g) => g.getAttribute("data-glyph") !== "success");
    expect(busy.length).toBeGreaterThan(0);
    for (const g of busy) expect(g.hasAttribute("data-sprout")).toBe(false);
    // Turning into a success sprouts the new glyph.
    act(() => d.live());
    await waitFor(() =>
      expect(glyphs().some((g) => g.getAttribute("data-glyph") === "success" && g.hasAttribute("data-sprout"))).toBe(
        true,
      ),
    );
    act(() => toast.close());
  });
});

describe("TimeseriesChart", () => {
  test("an empty series renders a labelled placeholder at the same height instead of crashing", () => {
    const { container } = render(<TimeseriesChart aria-label="Requests" series={[]} height={150} />);
    const empty = container.querySelector("[data-empty]") as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.getAttribute("role")).toBe("img");
    expect(empty.getAttribute("aria-label")).toBe("Requests: No data for this range");
    expect(empty.style.height).toBe("150px");
  });

  test("series with no points count as empty; one point still plots", () => {
    const { container, rerender } = render(
      <TimeseriesChart aria-label="Errors" series={[{ id: "e", label: "Errors", data: [] }]} emptyText="Nothing yet" />,
    );
    expect(container.textContent).toContain("Nothing yet");
    rerender(
      <TimeseriesChart aria-label="Errors" series={[{ id: "e", label: "Errors", data: [{ time: 5, value: 1 }] }]} />,
    );
    expect(container.querySelector("[data-empty]")).toBeNull();
    expect(container.querySelector(".sb-chart")).not.toBeNull();
  });

  test("epoch milliseconds read as clock times within two days, dates beyond, plain numbers otherwise", () => {
    const t0 = Date.UTC(2026, 10, 5, 13, 0);
    const hh = String(new Date(t0).getHours()).padStart(2, "0");
    expect(timeFormatter([t0, t0 + 3_600_000])(t0)).toBe(`${hh}:00`);
    expect(timeFormatter([t0, t0 + 7 * 86_400_000])(t0)).toMatch(/^Nov \d{1,2}$/);
    expect(timeFormatter([0, 23])(14.5)).toBe("14.5");
    expect(timeFormatter([0, 23])(1200)).toBe("1,200");
  });

  test("epoch ticks land on whole local hours, about as many as asked for", () => {
    const start = new Date(2026, 10, 5, 0, 7).getTime();
    const ticks = timeTicks([start, start + 24 * 3_600_000], 5) ?? [];
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(5);
    for (const t of ticks) {
      const d = new Date(t);
      expect(d.getMinutes()).toBe(0);
      expect(d.getHours() % 6).toBe(0);
    }
    expect(timeTicks([0, 23])).toBeUndefined();
  });

  test("the rendered axis never shows raw millisecond timestamps", () => {
    const t0 = Date.UTC(2026, 10, 5, 0, 0);
    const data = Array.from({ length: 25 }, (_, h) => ({ time: t0 + h * 3_600_000, value: 100 + h }));
    const { container } = render(
      <TimeseriesChart aria-label="Requests" series={[{ id: "r", label: "Requests", data }]} />,
    );
    expect(container.textContent ?? "").not.toMatch(/\d{12,}/);
  });
});

describe("Sparkline", () => {
  test("marks the current point, and can opt out", () => {
    const { container, rerender } = render(<Sparkline aria-label="Requests" data={[1, 4, 2, 6]} />);
    const withDot = container.querySelectorAll("circle").length;
    rerender(<Sparkline aria-label="Requests" data={[1, 4, 2, 6]} current={false} />);
    expect(withDot).toBeGreaterThan(container.querySelectorAll("circle").length);
  });

  test("an empty sparkline renders without a dot or a crash", () => {
    const { container } = render(<Sparkline aria-label="Requests" data={[]} />);
    expect(container.querySelector('[aria-label="Requests"]')).not.toBeNull();
  });
});
