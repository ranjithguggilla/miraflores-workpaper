import { type Page, expect } from "@playwright/test";
/** The role switcher is a demo device: a select + Switch button in the top bar. */
export async function actAs(page: Page, name: string) {
  await page.goto("/");
  const select = page.getByLabel("Acting as");
  const value = await select.locator("option", { hasText: name }).first().getAttribute("value");
  await select.selectOption(value!);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Switch" }).click(),
  ]);
  // The switch sets a cookie and redirects; wait until the top bar reflects the new actor before moving on.
  await expect(page.getByLabel("Acting as")).toHaveValue(value!, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
}

/** Click a form button and wait for its server action to complete, then for the page to settle. */
export async function submit(page: Page, button: import("@playwright/test").Locator) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("networkidle");
}
