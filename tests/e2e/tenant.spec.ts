import { test, expect } from "@playwright/test";

/**
 * Tenant subsite renders block content server-side. In the sandbox (no live
 * Supabase) the route serves generated demo content for the subdomain; with
 * Supabase configured it renders the published page from the DB instead.
 */
test.describe("tenant subsite", () => {
  test("renders block content for the subdomain", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "x-forwarded-host": "demo.hokusites.com" },
    });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Demo"); // hero heading (title-cased subdomain)
    expect(html).toContain("What we do"); // services block
    expect(html).toContain("demo.hokusites.com"); // hero subheading
  });
});
