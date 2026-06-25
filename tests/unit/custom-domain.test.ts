import { describe, it, expect, vi } from "vitest";
import {
  addCustomDomain,
  refreshDomainStatus,
  assertCanAddCustomDomain,
  normalizeHostname,
  dnsInstructions,
  PlanGateError,
  type DomainsRepo,
  type DomainRecord,
} from "@/lib/domains/custom-domain";
import type { VercelDomainsClient } from "@/lib/integrations/vercel";

function fakeVercel(verified: boolean): VercelDomainsClient {
  return {
    addDomain: vi.fn().mockResolvedValue({
      id: "dom_123",
      verified,
      verification: verified
        ? []
        : [{ type: "A", name: "@", value: "76.76.21.21" }],
    }),
    getDomainStatus: vi.fn().mockResolvedValue({
      verified: true,
      sslStatus: "active",
      verification: [],
    }),
  };
}

function fakeRepo() {
  const rows: DomainRecord[] = [];
  const tenantDomains: Record<string, string | null> = {};
  const repo: DomainsRepo = {
    insertDomain: vi.fn(async (rec) => {
      const row = { ...rec, id: `row_${rows.length}` };
      rows.push(row);
      return row;
    }),
    updateStatus: vi.fn(async (hostname, patch) => {
      const row = rows.find((r) => r.hostname === hostname);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    }),
    setTenantCustomDomain: vi.fn(async (tenantId, hostname) => {
      tenantDomains[tenantId] = hostname;
    }),
  };
  return { repo, rows, tenantDomains };
}

describe("plan gate", () => {
  it("blocks the free plan", () => {
    expect(() => assertCanAddCustomDomain("free")).toThrow(PlanGateError);
  });
  it("allows the paid plan", () => {
    expect(() => assertCanAddCustomDomain("paid")).not.toThrow();
  });
});

describe("normalizeHostname", () => {
  it("strips scheme/path/port and lowercases", () => {
    expect(normalizeHostname("HTTPS://Shop.Example.com/path")).toBe("shop.example.com");
    expect(normalizeHostname("acme.co:443")).toBe("acme.co");
  });
  it("rejects invalid domains", () => {
    expect(() => normalizeHostname("not a domain")).toThrow();
    expect(() => normalizeHostname("localhost")).toThrow();
  });
});

describe("addCustomDomain", () => {
  it("free plan cannot reach the flow (no Vercel call)", async () => {
    const vercel = fakeVercel(false);
    const { repo } = fakeRepo();
    await expect(
      addCustomDomain({ plan: "free", tenantId: "t1", hostname: "shop.example.com", vercel, repo })
    ).rejects.toThrow(PlanGateError);
    expect(vercel.addDomain).not.toHaveBeenCalled();
    expect(repo.insertDomain).not.toHaveBeenCalled();
  });

  it("paid plan records the hostname and pending verification", async () => {
    const vercel = fakeVercel(false);
    const { repo, rows, tenantDomains } = fakeRepo();
    const { record, dns } = await addCustomDomain({
      plan: "paid",
      tenantId: "t1",
      hostname: "Shop.Example.com",
      vercel,
      repo,
    });
    expect(vercel.addDomain).toHaveBeenCalledWith("shop.example.com");
    expect(record.hostname).toBe("shop.example.com");
    expect(record.ssl_status).toBe("verifying");
    expect(rows).toHaveLength(1);
    expect(dns).toHaveLength(1);
    // Not routed until verified.
    expect(tenantDomains["t1"]).toBeUndefined();
    expect(repo.setTenantCustomDomain).not.toHaveBeenCalled();
  });

  it("promotes an already-verified domain to routing", async () => {
    const vercel = fakeVercel(true);
    const { repo, tenantDomains } = fakeRepo();
    const { record } = await addCustomDomain({
      plan: "paid",
      tenantId: "t1",
      hostname: "shop.example.com",
      vercel,
      repo,
    });
    expect(record.ssl_status).toBe("active");
    expect(tenantDomains["t1"]).toBe("shop.example.com");
  });
});

describe("refreshDomainStatus", () => {
  it("activates SSL and mirrors to tenant routing", async () => {
    const vercel = fakeVercel(false); // getDomainStatus returns active
    const { repo, tenantDomains } = fakeRepo();
    await repo.insertDomain({
      tenant_id: "t1",
      hostname: "shop.example.com",
      vercel_domain_id: "dom_123",
      ssl_status: "verifying",
      verification: [],
    });
    const rec = await refreshDomainStatus({
      tenantId: "t1",
      hostname: "shop.example.com",
      vercel,
      repo,
    });
    expect(rec?.ssl_status).toBe("active");
    expect(tenantDomains["t1"]).toBe("shop.example.com");
  });
});

describe("dnsInstructions", () => {
  it("formats copy-paste DNS lines", () => {
    expect(
      dnsInstructions([{ type: "CNAME", name: "www", value: "cname.vercel-dns.com" }])
    ).toEqual(["CNAME  www  →  cname.vercel-dns.com"]);
  });
});
