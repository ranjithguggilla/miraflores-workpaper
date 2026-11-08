import { test, expect } from "@playwright/test";
import { actAs } from "./helpers";
test("F8949.B.N1 traces to the D28 page field and the D11 supplement", async ({ page }) => {
  await actAs(page, "Priya Raman");
  await page.goto("/lines/F8949.B.N1");
  await expect(page.getByRole("heading", { name: "Trace" })).toBeVisible();
  await expect(page.locator("mark.hl").filter({ hasText: "19,240.00" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /D28 · Northlake Securities/ }).first()).toBeVisible();
  await expect(page.getByText(/D11/).first()).toBeVisible();
  await expect(page.getByText("Adjusted").first()).toBeVisible();
});
