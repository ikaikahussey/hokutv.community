import { test, expect } from "@playwright/test";

/**
 * Host-routing matrix (Phase 1). Multi-host is emulated by sending an explicit
 * `x-forwarded-host` (what a proxy/Vercel sets), so DNS isn't required. Each
 * host must land on the correct route group; unknown hosts 404; internal
 * segments must not leak onto the public apex.
 */

test.describe("host routing", () => {
  test("apex host serves the marketing landing", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "x-forwarded-host": "hoku.com" },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/websites for local businesses/i);
  });

  test("app host serves the control plane", async ({ request }) => {
    const res = await request.get("/", { headers: { "x-forwarded-host": "app.hoku.com" } });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("HOKU Admin");
  });

  test("ads host serves the ad-serving zone", async ({ request }) => {
    const res = await request.get("/", { headers: { "x-forwarded-host": "ads.hoku.com" } });
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/ad serving/i);
  });

  test("tenant subdomain serves that tenant's subsite", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "x-forwarded-host": "acme.hokusites.com" },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("acme");
  });

  test("unknown host returns 404", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "x-forwarded-host": "nope.example.com" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });

  test("internal segments do not leak onto the public apex", async ({ request }) => {
    for (const path of ["/app", "/ads", "/s/acme"]) {
      const res = await request.get(path, {
        headers: { "x-forwarded-host": "hoku.com" },
        maxRedirects: 0,
      });
      expect(res.status(), `${path} on apex should 404`).toBe(404);
    }
  });

  test("the app host does not emit a domain-wide cookie", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "x-forwarded-host": "app.hoku.com" },
    });
    const setCookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie");
    for (const c of setCookies) {
      expect(c.value.toLowerCase()).not.toContain("domain=");
    }
  });
});
