import { test, expect } from "@playwright/test";

/**
 * The magic-link sign-in page renders on the control-plane host. The full
 * Supabase round trip needs the hosted Auth service (covered as a contract test
 * in tests/unit/magic-link); here we prove the route + host rewrite + client
 * form render correctly.
 */
test.describe("auth UI", () => {
  test("login page renders on the app host", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /sign in to hoku/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/you@business/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /email me a link/i })
    ).toBeVisible();
  });

  test("the login route is not exposed on the public apex", async ({ request }) => {
    const res = await request.get("/login", {
      headers: { "x-forwarded-host": "hoku.com" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });
});
