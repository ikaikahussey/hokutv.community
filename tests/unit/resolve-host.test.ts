import { describe, it, expect } from "vitest";
import { resolveHost, RESERVED_PREFIXES } from "@/lib/domains/resolve-host";
import type { DomainConfig } from "@/lib/domains/config";

const cfg: DomainConfig = {
  appBaseDomain: "hoku.com",
  tenantBaseDomain: "hokusites.com",
  adsHost: "ads.hoku.com",
};

describe("resolveHost", () => {
  it("maps the apex (and www) to the marketing zone", () => {
    expect(resolveHost("hoku.com", cfg)).toMatchObject({
      zone: "apex",
      rewriteBase: "",
    });
    expect(resolveHost("www.hoku.com", cfg).zone).toBe("apex");
  });

  it("maps app.hoku.com to the app zone with /app rewrite", () => {
    expect(resolveHost("app.hoku.com", cfg)).toMatchObject({
      zone: "app",
      rewriteBase: "/app",
    });
  });

  it("maps the ads host to the ads zone", () => {
    expect(resolveHost("ads.hoku.com", cfg)).toMatchObject({
      zone: "ads",
      rewriteBase: "/ads",
    });
  });

  it("maps tenant subdomains to /s/<subdomain>", () => {
    expect(resolveHost("acme.hokusites.com", cfg)).toMatchObject({
      zone: "tenant",
      subdomain: "acme",
      rewriteBase: "/s/acme",
    });
  });

  it("strips the port and lowercases", () => {
    expect(resolveHost("ACME.hokusites.com:3000", cfg)).toMatchObject({
      zone: "tenant",
      subdomain: "acme",
    });
  });

  it("uses the first value of an x-forwarded-host list", () => {
    expect(resolveHost("app.hoku.com, proxy.internal", cfg).zone).toBe("app");
  });

  it("treats bare localhost as the apex for local dev", () => {
    expect(resolveHost("localhost:3000", cfg).zone).toBe("apex");
    expect(resolveHost("127.0.0.1", cfg).zone).toBe("apex");
  });

  it("treats the bare tenant base domain (no subdomain) as unknown", () => {
    expect(resolveHost("hokusites.com", cfg).zone).toBe("unknown");
  });

  it("treats an external FQDN as a custom domain (routed to tenant lookup)", () => {
    expect(resolveHost("shop.example.com", cfg)).toMatchObject({
      zone: "custom",
      rewriteBase: "/s/shop.example.com",
    });
  });

  it("treats an empty host as unknown", () => {
    expect(resolveHost("", cfg).zone).toBe("unknown");
  });

  it("does not treat our own hoku.com subdomains as custom domains", () => {
    expect(resolveHost("random.hoku.com", cfg).zone).toBe("unknown");
  });

  it("exposes the reserved internal prefixes", () => {
    expect(RESERVED_PREFIXES).toContain("/app");
    expect(RESERVED_PREFIXES).toContain("/ads");
    expect(RESERVED_PREFIXES).toContain("/s");
  });
});
