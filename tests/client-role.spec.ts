import { test, expect } from "@playwright/test";
import { actAs, submit } from "./helpers";
test("the client is confined to Client and Filing, and can only approve", async ({ page }) => {
  await actAs(page, "Erik Lindqvist");
  await page.goto("/");
  await expect(page).toHaveURL(/\/filing$/);
  await expect(page.getByRole("link", { name: "Inbox" })).toHaveCount(0);
  await page.goto("/lines/Sch1.17");
  await expect(page).toHaveURL(/\/filing$/);
  await page.getByPlaceholder("e-signature PIN").fill("1234");
  await submit(page, page.getByRole("button", { name: /Approve & sign 8879/ }));
  await expect(page.getByText(/client ·/i).first()).toBeVisible();
});
