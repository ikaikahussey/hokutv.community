import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility gate (Phase 9): no serious/critical axe violations on the key
 * public surfaces. The clientele aren't technical — a11y is enforced, not
 * optional (build-prompt §5.5).
 */
async function expectAccessible(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  expect(
    serious,
    serious.map((v) => `${v.id}: ${v.help}`).join("\n")
  ).toEqual([]);
}

test.describe("accessibility", () => {
  test("apex marketing page", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "hoku.com" });
    await page.goto("/");
    await expectAccessible(page);
  });

  test("tenant subsite", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "demo.hokusites.com" });
    await page.goto("/");
    await expectAccessible(page);
  });

  test("directory", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "hoku.com" });
    await page.goto("/directory");
    await expectAccessible(page);
  });
});
