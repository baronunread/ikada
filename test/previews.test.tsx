import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const dir = join(import.meta.dir, "../site/src/examples");

// The overview's tiles claim to be the real components ("Press anything"). A controlled component given a fixed value and
// a no-op handler looks right and does nothing when pressed (the segmented control and the pagination tile did exactly that).
describe("the overview tiles are live", () => {
  test("no example gives a controlled prop a no-op handler", () => {
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(
        /\bon(?:ValueChange|CheckedChange|PageChange|OpenChange|Change|SelectionChange)=\{\(\)\s*=>\s*\{\s*\}\}/g,
      )) {
        offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the segmented control tile selects what is pressed", async () => {
    const { preview } = await import("../site/src/examples/segmented-control");
    render(<>{preview()}</>);
    const user = userEvent.setup();
    const pressed = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed().map((b) => b.textContent)).toEqual(["24h"]);
    await user.click(screen.getByRole("button", { name: "7d" }));
    expect(pressed().map((b) => b.textContent)).toEqual(["7d"]);
    await user.click(screen.getByRole("button", { name: "1h" }));
    expect(pressed().map((b) => b.textContent)).toEqual(["1h"]);
  });

  test("the dialog tile opens a real dialog", async () => {
    const { preview } = await import("../site/src/examples/dialog");
    render(<>{preview()}</>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Delete project/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  test("the button tile deploys when pressed", async () => {
    const { preview } = await import("../site/src/examples/button");
    render(<>{preview()}</>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Deploy" }));
    expect(
      screen.getByRole("button", { name: /Deploy/ }).hasAttribute("disabled") ||
        screen.getByRole("button", { name: /Deploy/ }).getAttribute("aria-busy") === "true",
    ).toBe(true);
  });

  test("the pagination tile moves to the page pressed", async () => {
    const { preview } = await import("../site/src/examples/pagination");
    render(<>{preview()}</>);
    const user = userEvent.setup();
    expect(screen.getByText(/Page 3 of 12/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/Page 4 of 12/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText(/Page 2 of 12/)).toBeTruthy();
  });
});
