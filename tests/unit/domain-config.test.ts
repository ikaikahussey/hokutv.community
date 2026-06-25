import { describe, it, expect } from "vitest";
import { getDomainConfig } from "@/lib/domains/config";
import { resolveHost } from "@/lib/domains/resolve-host";

describe("getDomainConfig", () => {
  it("uses explicit domain env vars when set", () => {
    const cfg = getDomainConfig({
      APP_BASE_DOMAIN: "hoku.com",
      TENANT_BASE_DOMAIN: "hokusites.com",
      ADS_HOST: "ads.hoku.com",
    });
    expect(cfg).toEqual({
      appBaseDomain: "hoku.com",
      tenantBaseDomain: "hokusites.com",
      adsHost: "ads.hoku.com",
    });
  });

  it("falls back to the Vercel production URL for the apex (demo deploy)", () => {
    const cfg = getDomainConfig({ VERCEL_PROJECT_PRODUCTION_URL: "hoku-demo.vercel.app" });
    expect(cfg.appBaseDomain).toBe("hoku-demo.vercel.app");
    // So the project's vercel.app host resolves as the marketing apex, not 404.
    expect(resolveHost("hoku-demo.vercel.app", cfg).zone).toBe("apex");
  });

  it("explicit APP_BASE_DOMAIN wins over the Vercel fallback", () => {
    const cfg = getDomainConfig({
      APP_BASE_DOMAIN: "hoku.com",
      VERCEL_PROJECT_PRODUCTION_URL: "hoku-demo.vercel.app",
    });
    expect(cfg.appBaseDomain).toBe("hoku.com");
  });

  it("defaults to the production hosts when nothing is set", () => {
    expect(getDomainConfig({})).toEqual({
      appBaseDomain: "hoku.com",
      tenantBaseDomain: "hokusites.com",
      adsHost: "ads.hoku.com",
    });
  });
});
