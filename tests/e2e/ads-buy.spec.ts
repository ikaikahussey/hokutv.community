import { test, expect } from "@playwright/test";

/**
 * The full ad buying wizard, driven through the real UI on the app host:
 * Creative → Targeting → Budget → Review & Pay → Submit for approval. Runs in
 * demo mode (no Supabase/Stripe), so submit ends in the "in review" state — a
 * campaign is never auto-approved from the wizard.
 */
test.describe("ad buying wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/ads/buy");
  });

  test("creates a campaign end-to-end and lands in review", async ({ page }) => {
    await expect(page.getByTestId("wizard-step")).toContainText("Creative");

    // Step 1 — creative, with AI copy suggestion feeding the headline.
    await page.getByTestId("f-headline").fill("Kona Coffee Co");
    await page.getByTestId("suggest-copy").click();
    await expect(page.getByTestId("suggestions")).toBeVisible();
    await page.getByTestId("f-cta").fill("Order now");
    await page.getByTestId("f-url").fill("https://kona.example.com");
    // Live preview reflects the creative.
    await expect(page.getByTestId("ad-preview")).toContainText("Kona Coffee Co");
    await page.getByTestId("next").click();

    // Step 2 — targeting; estimated reach is shown.
    await expect(page.getByTestId("wizard-step")).toContainText("Targeting");
    await page.getByTestId("f-category").selectOption("coffee");
    await page.getByTestId("f-radius").fill("5");
    await expect(page.getByTestId("reach")).toContainText("people");
    await page.getByTestId("next").click();

    // Step 3 — budget package selection (flat prepaid).
    await expect(page.getByTestId("wizard-step")).toContainText("Budget");
    await page.getByTestId("pkg-growth").click();
    await page.getByTestId("next").click();

    // Step 4 — review & pay → submit for approval.
    await expect(page.getByTestId("wizard-step")).toContainText("Review");
    await expect(page.getByTestId("review")).toContainText("Kona Coffee Co");
    await page.getByTestId("pay-submit").click();

    // Terminal state: submitted for review (pending, not approved).
    await expect(page.getByTestId("submit-message")).toBeVisible();
    await expect(page.getByTestId("campaign-id")).toContainText("pending");
  });

  test("blocks a non-https destination at review", async ({ page }) => {
    await page.getByTestId("f-headline").fill("Test Biz");
    await page.getByTestId("f-cta").fill("Go");
    await page.getByTestId("f-url").fill("http://insecure.example.com");
    await page.getByTestId("next").click(); // targeting
    await page.getByTestId("next").click(); // budget
    await page.getByTestId("pkg-starter").click();
    await page.getByTestId("next").click(); // review
    await expect(page.getByTestId("review-errors")).toContainText("https");
    await expect(page.getByTestId("pay-submit")).toBeDisabled();
  });
});
