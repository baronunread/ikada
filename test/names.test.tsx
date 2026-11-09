import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Sparkline, TimeseriesChart } from "../src/charts";
import { SegmentedControl, Skeleton, StatusDot } from "../src";
import { transform } from "../codemods/0.2-rename-props.mjs";

describe("prop names: one vocabulary, the 0.1 spellings still work", () => {
  test("StatusDot takes tone, and the deprecated status", () => {
    const a = render(<StatusDot tone="danger" label="Failed" />);
    expect(a.container.querySelector("[data-status]")?.getAttribute("data-status")).toBe("danger");
    const b = render(<StatusDot status="success" label="Ready" />);
    expect(b.container.querySelector("[data-status]")?.getAttribute("data-status")).toBe("success");
  });

  test("Skeleton takes variant, and the deprecated kind", () => {
    const a = render(<Skeleton variant="circle" />);
    expect(a.container.firstElementChild?.className).toContain("rounded-full");
    const b = render(<Skeleton kind="block" />);
    expect(b.container.firstElementChild?.className).toContain("h-20");
  });

  test("charts take aria-label, and the deprecated ariaLabel", () => {
    const a = render(<Sparkline aria-label="Requests" data={[1, 2, 3]} />);
    expect(a.container.querySelector('[aria-label="Requests"]')).not.toBeNull();
    const b = render(<TimeseriesChart ariaLabel="Errors" series={[]} />);
    expect(b.container.querySelector('[aria-label^="Errors"]')).not.toBeNull();
  });

  test("a SegmentedControl option takes aria-label, and the deprecated ariaLabel", () => {
    const { getByLabelText } = render(
      <SegmentedControl
        aria-label="View"
        value="a"
        onValueChange={() => {}}
        options={[
          { value: "a", label: "A", "aria-label": "Grid" },
          { value: "b", label: "B", ariaLabel: "List" },
        ]}
      />,
    );
    expect(getByLabelText("Grid")).toBeTruthy();
    expect(getByLabelText("List")).toBeTruthy();
  });
});

describe("0.2 codemod", () => {
  test("renames the attributes on those tags and nothing else", () => {
    const before = `<StatusDot status="live" label={status} />
<Badge status="x" />
<Skeleton
  kind="circle"
  className="status"
/>
<Sparkline data={x} ariaLabel={\`a > b\`} />
<TimeseriesChart ariaLabel="Requests" series={[{ id: "r" }]} />
const o = { ariaLabel: "kept" };`;
    const after = transform(before);
    expect(after).toContain('<StatusDot tone="live" label={status} />');
    expect(after).toContain('<Badge status="x" />');
    expect(after).toContain('  variant="circle"');
    expect(after).toContain("aria-label={`a > b`}");
    expect(after).toContain('<TimeseriesChart aria-label="Requests"');
    expect(after).toContain('{ ariaLabel: "kept" }');
    expect(transform(after)).toBe(after);
  });
});
