import { test, expect } from "@playwright/test";

test.describe("security hardening", () => {
  test("responses carry baseline security headers", async ({ request }) => {
    const res = await request.get("/", { headers: { "x-forwarded-host": "hoku.com" } });
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("geolocation=()");
  });

  test("the app host never emits a domain-wide auth cookie", async ({ request }) => {
    const res = await request.get("/", { headers: { "x-forwarded-host": "app.hoku.com" } });
    for (const h of res.headersArray()) {
      if (h.name.toLowerCase() === "set-cookie") {
        expect(h.value.toLowerCase()).not.toContain("domain=");
      }
    }
  });

  test("the serving endpoint rate-limits and trips", async ({ request }) => {
    const host = { "x-forwarded-host": "ads.hoku.com" };
    // Read the configured limit from the first response's headers.
    const first = await request.get("/api/serve?slot=s", {
      headers: { ...host, "x-forwarded-for": "9.9.9.9" },
    });
    const limit = Number(first.headers()["x-ratelimit-limit"] ?? "30");
    expect(limit).toBeGreaterThan(0);

    // Fire enough concurrent requests (same client key) to exceed the window.
    const burst = await Promise.all(
      Array.from({ length: limit + 10 }, () =>
        request.get("/api/serve?slot=s", {
          headers: { ...host, "x-forwarded-for": "9.9.9.9" },
        })
      )
    );
    expect(burst.some((r) => r.status() === 429)).toBe(true);
  });
});
