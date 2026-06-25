import { test, expect } from "@playwright/test";

/**
 * The acquisition claim wizard (Phase B/C), driven through the real UI on the
 * app host. A claim requires the postcard token AND a verified second factor
 * before the provisional site transfers — claimSite enforces both. Runs in demo
 * mode, which surfaces the verification code so the flow is testable offline.
 */
test.describe("claim wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/claim");
  });

  test("rejects an unknown claim token", async ({ page }) => {
    await page.getByTestId("claim-token").fill("not-a-real-token");
    await page.getByTestId("claim-start").click();
    await expect(page.getByTestId("claim-error")).toContainText("couldn't find");
  });

  test("requires a matching second factor, then claims and publishes", async ({ page }) => {
    await page.getByTestId("claim-token").fill("demo-postcard");
    await page.getByTestId("claim-start").click();

    // Verification step appears with the demo code revealed.
    await expect(page.getByTestId("demo-code")).toContainText("424242");

    // Wrong code is blocked (verification required before transfer).
    await page.getByTestId("claim-code").fill("000000");
    await page.getByTestId("claim-finish").click();
    await expect(page.getByTestId("claim-error")).toContainText("didn't match");

    // Correct code completes the claim and publishes the site.
    await page.getByTestId("claim-code").fill("424242");
    await page.getByTestId("claim-finish").click();
    await expect(page.getByTestId("claim-success")).toContainText("founder credit");
  });
});
