import { test, expect } from "@playwright/test";

const apex = { "x-forwarded-host": "hoku.com" };

test.describe("directory (apex)", () => {
  test("lists only published+listed tenants", async ({ page }) => {
    await page.setExtraHTTPHeaders(apex);
    await page.goto("/directory");
    const dir = page.getByTestId("directory");
    await expect(dir).toContainText("kalihi-coffee");
    await expect(dir).toContainText("north-shore-surf");
    await expect(dir).toContainText("manoa-plumbing");
    // unlisted + unpublished demo tenants must not appear
    await expect(dir).not.toContainText("hidden-cafe");
    await expect(dir).not.toContainText("draft-only");
  });

  test("search narrows the results", async ({ page }) => {
    await page.setExtraHTTPHeaders(apex);
    await page.goto("/directory?q=coffee");
    const dir = page.getByTestId("directory");
    await expect(dir).toContainText("kalihi-coffee");
    await expect(dir).not.toContainText("north-shore-surf");
  });

  test("category filter narrows the results", async ({ page }) => {
    await page.setExtraHTTPHeaders(apex);
    await page.goto("/directory?category=surf");
    const dir = page.getByTestId("directory");
    await expect(dir).toContainText("north-shore-surf");
    await expect(dir).not.toContainText("manoa-plumbing");
  });
});
