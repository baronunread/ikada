import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Keyboard interaction in a real browser for the overlays and composite controls, against the
 * playground. Base UI supplies the APG behaviour; these pin what ikada has to keep true on top of
 * it: where focus lands, where it returns, which keys act, and that a closed layer really leaves.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/?view=light");
  // Handlers attach on hydration; do not press keys before that.
  await page.waitForLoadState("networkidle");
});

const inside = (page: Page, container: Locator): Promise<boolean> =>
  container.evaluate((el) => el.contains(document.activeElement));

test("Dialog: Enter opens, focus is trapped, Escape closes and focus returns to the trigger", async ({ page }) => {
  const trigger = page.locator('button[aria-haspopup="dialog"]', { hasText: "Delete project" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await inside(page, dialog)).toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    // Base UI bounces focus off its guards, so settle before judging.
    await expect.poll(() => inside(page, dialog), { message: `focus left the dialog after ${i + 1} Tabs` }).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Popover: Enter opens and moves focus in, Escape closes and returns focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Rollout settings" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog");
  await expect(popover).toBeVisible();
  expect(await inside(page, popover)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Tooltip: keyboard focus shows it, Escape hides it", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Hover or focus me" });
  await trigger.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const tip = page.getByText("Copies the deployment ID");
  await expect(tip).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-describedby", /.+/);
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
});

test("CommandPalette: arrows and Enter pick, Escape closes and returns focus", async ({ page }) => {
  const opener = page.getByRole("button", { name: /Find anything/ }).first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  const input = palette.getByRole("combobox");
  await expect(input).toBeFocused();
  await input.fill("zzzzzz");
  await expect(palette.getByRole("option")).toHaveCount(0);
  await input.fill("");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^Picked:/)).toBeVisible();
  await expect(palette).toBeHidden();
  await expect(opener).toBeFocused();
});

test("CommandPalette: Cmd or Ctrl K opens it from anywhere and Escape closes it", async ({ page }) => {
  // The playground mounts two palettes and both answer the shortcut, so judge by the DOM, not the a11y tree
  // (two open modals hide each other from it).
  const dialogs = page.locator('[role="dialog"][aria-label="Command palette"]');
  await page.keyboard.press("ControlOrMeta+K");
  await expect(dialogs.first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialogs).toHaveCount(0);
});

test("RadioGroup: one tab stop, arrows move and select, disabled options are skipped", async ({ page }) => {
  const group = page.getByRole("radiogroup", { name: "Log retention" });
  const radios = group.getByRole("radio");
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  await page.keyboard.press("ArrowDown");
  // 90 days is disabled: the arrow wraps to the first option.
  await expect(radios.nth(0)).toBeChecked();
  await page.keyboard.press("ArrowUp");
  await expect(radios.nth(1)).toBeChecked();
  expect(await group.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
});

test("Toast: Alt+T focuses the newest toast, Escape dismisses it", async ({ page }) => {
  await page.getByRole("button", { name: "Success", exact: false }).first().click();
  const region = page.getByRole("region", { name: /Notifications/ });
  await expect(region.getByText("Deployment ready")).toBeVisible();
  await page.keyboard.press("Alt+T");
  expect(await inside(page, region)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(region.getByText("Deployment ready")).toHaveCount(0, { timeout: 2000 });
});

test("Select: Enter opens, arrows and Enter choose, the listbox leaves within its exit animation", async ({ page }) => {
  const select = page
    .getByRole("region", { name: "Form controls" })
    .getByRole("combobox", { name: "Region", exact: true });
  await select.focus();
  const before = await select.textContent();
  await page.keyboard.press("Enter");
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(select).not.toHaveText(before ?? "");
  await expect(select).toBeFocused();
  // Base UI keeps the closed popup in the DOM as `hidden`; what matters is that it is gone from the
  // accessibility tree within the 110ms exit (the audit saw the node at 300ms and took it for a leak).
  await expect(list).toHaveCount(0, { timeout: 300 });
});
