import { test, expect } from "@playwright/test";
import { actAs, submit } from "./helpers";
const SSN = /\b\d{3}-\d{2}-\d{4}\b/;
test("SSNs are absent from the payload for staff without clearance and appear only after a logged unmask", async ({ page, request }) => {
  await actAs(page, "Marcus Bell");
  for (const path of ["/client", "/", "/areas/intake_and_engagement", "/documents/D71"]) {
    const res = await request.get(path);
    expect(await res.text(), `${path} leaks an SSN`).not.toMatch(SSN);
  }
  await expect(page.getByText("Sensitive data masked")).toBeVisible();
  await actAs(page, "Helen Strand");
  await page.goto("/client");
  expect(await (await request.get("/client")).text()).not.toMatch(SSN);
  await submit(page, page.getByRole("button", { name: /Show SSNs/ }));
  await expect(page.getByText("unmasked — logged")).toBeVisible();
  await expect(page.getByText(SSN).first()).toBeVisible();
  await page.goto("/firm");
  await expect(page.getByText(/Helen Strand .*unmasked household/).first()).toBeVisible();
});
