import { test, expect } from "@playwright/test";
import { actAs, submit } from "./helpers";
test("a reviewer sign-off reopens when a later adjustment lands in the area", async ({ page }) => {
  await actAs(page, "Daniel Ortiz");
  await page.goto("/areas/deductions_and_credits");
  await submit(page, page.getByRole("button", { name: /Sign off as reviewer/ }));
  await expect(page.getByText(/Reviewer · Daniel Ortiz/).first()).toBeVisible();
  await actAs(page, "Priya Raman");
  await page.goto("/lines/SchA.11");
  await page.getByPlaceholder(/New value/).fill("1400");
  await page.getByPlaceholder(/Why/).fill("test: one receipt not substantiated");
  await submit(page, page.getByRole("button", { name: "Record adjustment" }));
  await expect(page.getByText("Adjusted").first()).toBeVisible();
  await page.goto("/areas/deductions_and_credits");
  await expect(page.getByText(/reopened by adjust/).first()).toBeVisible();
});
