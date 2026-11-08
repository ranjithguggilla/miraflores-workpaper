import { test, expect } from "@playwright/test";
import { actAs, submit } from "./helpers";
test("bulk verify writes one batch; undoing the batch removes both tags", async ({ page }) => {
  await actAs(page, "Priya Raman");
  await page.goto("/areas/business");
  await page.locator('input[name="keys"][value="SchC.8"]').check();
  await page.locator('input[name="keys"][value="SchC.15"]').check();
  await submit(page, page.getByRole("button", { name: /Verify selected/ }));
  await expect(page.locator("tr", { hasText: "SchC.8" }).getByText("Agreed to source")).toBeVisible();
  await expect(page.locator("tr", { hasText: "SchC.15" }).getByText("Agreed to source")).toBeVisible();
  await page.goto("/activity");
  // undo the batch that contains our SchC.8 verification, not the newest batch on the log
  await submit(page, page.locator("tr", { hasText: "SchC.8" }).getByRole("button", { name: /undo batch/ }).first());
  await page.goto("/areas/business");
  await expect(page.locator("tr", { hasText: "SchC.8" }).getByText("Unverified")).toBeVisible();
});
