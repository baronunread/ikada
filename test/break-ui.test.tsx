import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Sparkline, TimeseriesChart } from "../src/charts";
import { Avatar } from "../src/components/avatar";
import { Badge } from "../src/components/badge";
import { Breadcrumbs } from "../src/components/breadcrumbs";
import { Button } from "../src/components/button";
import { SegmentedControl } from "../src/components/segmented-control";

afterEach(cleanup);

/** Worst-case data: the longest realistic values, plus the ones that break string code (emoji, empty). */
const LONG_PROJECT = "customer-onboarding-and-billing-reconciliation-service-production-eu-west";

describe("worst-case data", () => {
  test("Avatar takes the first whole character, even an emoji or a combined one", () => {
    const initial = (name: string) => render(<Avatar name={name} />).container.textContent;
    expect(initial("🚀 Launch day")).toBe("🚀");
    expect(initial("👩‍💻 Ada")).toBe("👩‍💻");
    expect(initial("  jo")).toBe("J");
    expect(initial("")).toBe("?");
    expect(initial("   ")).toBe("?");
  });

  test("Badge truncates a long label and keeps the full text in a title", () => {
    const { getByText, container } = render(<Badge tone="success">{LONG_PROJECT}</Badge>);
    const text = getByText(LONG_PROJECT);
    expect(text.className).toContain("truncate");
    expect(text.getAttribute("title")).toBe(LONG_PROJECT);
    expect(container.firstElementChild?.className).toContain("max-w-full");
  });

  test("Button truncates a text label instead of overflowing, and leaves nodes alone", () => {
    const { getByText } = render(
      <>
        <Button>{LONG_PROJECT}</Button>
        <Button loading>Saving</Button>
      </>,
    );
    expect(getByText(LONG_PROJECT).className).toContain("truncate");
    expect(getByText("Saving").className).toContain("truncate");
    cleanup();
    const { container } = render(
      <Button>
        <b>Node</b>
      </Button>,
    );
    // The node sits straight in the morph layer (no truncating wrapper around it), inside the button.
    const node = container.querySelector("b");
    expect(node?.parentElement?.getAttribute("data-layer")).toBe("live");
    expect(node?.closest("[data-slot=button]")).toBeTruthy();
  });

  test("Breadcrumbs give every truncated crumb a title", () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: LONG_PROJECT, href: "#a" }, { label: `${LONG_PROJECT}-current` }]} />,
    );
    expect(getByText(LONG_PROJECT).getAttribute("title")).toBe(LONG_PROJECT);
    expect(getByText(`${LONG_PROJECT}-current`).getAttribute("title")).toBe(`${LONG_PROJECT}-current`);
  });

  test("SegmentedControl keeps every option at its content width and scrolls instead of overlapping", () => {
    const { getByRole, getByText } = render(
      <SegmentedControl
        aria-label="Range"
        value="a"
        onValueChange={() => {}}
        options={[
          { value: "a", label: "Last 24 hours" },
          { value: "b", label: LONG_PROJECT },
        ]}
      />,
    );
    expect(getByRole("group").className).toContain("overflow-x-auto");
    expect(getByText(LONG_PROJECT).getAttribute("title")).toBe(LONG_PROJECT);
  });

  test("Sparkline drops NaN and Infinity instead of throwing", () => {
    expect(() =>
      render(<Sparkline data={[1, Number.NaN, 3, Number.POSITIVE_INFINITY]} aria-label="Requests" />),
    ).not.toThrow();
    cleanup();
    expect(() => render(<Sparkline data={[Number.NaN]} aria-label="Requests" />)).not.toThrow();
  });

  test("TimeseriesChart drops non-finite points, shows a lone point and shortens a long deploy label", () => {
    const point = (time: number, value: number) => ({ time, value });
    expect(() =>
      render(
        <TimeseriesChart
          aria-label="Requests"
          series={[{ id: "a", label: "A", data: [point(0, 1), point(1, Number.NaN), point(2, 3)] }]}
        />,
      ),
    ).not.toThrow();
    cleanup();
    const { container } = render(
      <TimeseriesChart
        aria-label="Requests"
        series={[{ id: "a", label: "A", data: [point(0, 1), point(10, 3)] }]}
        deploy={{ time: 5, label: `Deploy of ${LONG_PROJECT} v1284` }}
      />,
    );
    const label = [...container.querySelectorAll("text")].find((t) => t.textContent?.startsWith("Deploy of"));
    expect(label?.textContent?.endsWith("…")).toBe(true);
    expect(label?.textContent?.length).toBeLessThanOrEqual(28);
    cleanup();
    expect(() =>
      render(<TimeseriesChart aria-label="Requests" series={[{ id: "a", label: "A", data: [point(0, 5)] }]} />),
    ).not.toThrow();
  });
});
