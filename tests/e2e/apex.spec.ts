import { test, expect } from "@playwright/test";

test.describe("apex marketing page", () => {
  test("loads and renders the HOKU hero", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /websites for local businesses/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});
