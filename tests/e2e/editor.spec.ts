import { test, expect } from "@playwright/test";

/**
 * Create → edit → reorder → publish, driven through the real editor UI (pure
 * client state over page-ops; no DB needed). The live preview reuses the exact
 * tenant renderer, so this also asserts rendered HTML reflects the block JSON.
 */
test.describe("CMS editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/editor");
  });

  test("supports create, edit, reorder and publish", async ({ page }) => {
    await expect(page.getByTestId("status")).toHaveText("draft");

    // create
    await page.getByRole("button", { name: "Add Hero" }).click();
    await expect(page.getByTestId("row-0")).toContainText("Hero");

    // edit
    await page.getByTestId("hero-heading").fill("Test Biz");
    await expect(page.getByTestId("preview")).toContainText("Test Biz");

    // add a second block, then reorder it above the hero
    await page.getByRole("button", { name: "Add Contact" }).click();
    await expect(page.getByTestId("row-1")).toContainText("Contact");
    await page.getByTestId("row-1").getByLabel("Move up").click();
    await expect(page.getByTestId("row-0")).toContainText("Contact");
    await expect(page.getByTestId("row-1")).toContainText("Hero");

    // publish
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByTestId("status")).toHaveText("published");

    // preview still reflects the edited content
    await expect(page.getByTestId("preview")).toContainText("Test Biz");
  });
});
