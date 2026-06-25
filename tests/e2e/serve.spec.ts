import { test, expect } from "@playwright/test";

/**
 * Ad serving on the isolated ads host. In the sandbox (no DB) a demo campaign is
 * served; the response is an on-brand creative token config, not baked HTML.
 */
test.describe("ad serving (ads host)", () => {
  test("returns an on-brand creative for a matching context", async ({ request }) => {
    const res = await request.get("/api/serve?slot=sidebar&category=coffee", {
      headers: { "x-forwarded-host": "ads.hoku.com" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.campaignId).toBeTruthy();
    expect(body.creative.headline).toBeTruthy();
    // Brand tokens travel with the creative (token-driven, not baked image).
    expect(body.creative.brand["--brand-600"]).toMatch(/^#/);
  });
});
