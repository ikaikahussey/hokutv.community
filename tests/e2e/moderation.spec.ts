import { test, expect } from "@playwright/test";

/**
 * The manual moderation queue (platform_admin) and host participation, driven
 * through the real UI on the app host. Demo mode seeds one clean campaign and
 * one that trips the automated checks.
 */
test.describe("ad moderation queue", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/moderation");
  });

  test("approves a clean campaign and rejects a flagged one with a refund", async ({ page }) => {
    await expect(page.getByTestId("moderation-queue")).toBeVisible();

    // The flagged campaign surfaces automated reasons (prohibited + non-https).
    const flagged = page.getByTestId("mod-row-cmp_flag");
    await expect(flagged.getByTestId("auto-flags")).toContainText("prohibited");

    // Approve the clean one.
    const clean = page.getByTestId("mod-row-cmp_clean");
    await clean.getByTestId("approve").click();
    await expect(clean.getByTestId("decision")).toHaveText("approved");

    // Reject the flagged one → refund message.
    await flagged.getByTestId("reject").click();
    await expect(flagged.getByTestId("decision")).toHaveText("rejected");
    await expect(flagged.getByTestId("decision-message")).toContainText("refund");
  });
});

test.describe("host participation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/participation");
  });

  test("defaults to opted-in and saves an opt-out", async ({ page }) => {
    const sidebar = page.getByTestId("slot-sidebar");
    await expect(sidebar).toHaveText("On"); // default opt-in
    await sidebar.click();
    await expect(sidebar).toHaveText("Off");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("participation-message")).toContainText("Opted out");
  });
});
