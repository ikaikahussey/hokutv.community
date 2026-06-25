import { describe, it, expect, vi } from "vitest";
import { runBatch, hasMailableAddress, type AcqDeps } from "@/lib/acq/engine";
import { postcardComplianceIssues } from "@/lib/acq/postcard";
import { PROVISIONAL_TENANT_FLAGS } from "@/lib/acq/repo";
import type { Business } from "@/lib/acq/types";

const addr = { line1: "1 Main", city: "Honolulu", state: "HI", zip: "96817" };

const businesses: Business[] = [
  { placeId: "good", name: "Kalihi Coffee", category: "coffee", address: addr, phone: "808-555-0100" },
  { placeId: "noaddr", name: "No Address LLC", category: "x", address: { line1: "", city: "", state: "", zip: "" } },
  { placeId: "sup", name: "Suppressed Co", category: "y", address: addr },
  { placeId: "seen", name: "Already Seen", category: "z", address: addr },
];

function makeDeps() {
  const created: string[] = [];
  const mailed: { backHtml: string }[] = [];
  const screenshots: string[] = [];
  const deps: AcqDeps = {
    places: { search: vi.fn().mockResolvedValue(businesses) },
    screenshot: vi.fn(async (_url, tenantId) => {
      screenshots.push(tenantId);
      return `https://cdn/${tenantId}.png`;
    }),
    mail: {
      sendPostcard: vi.fn(async (input) => {
        mailed.push({ backHtml: input.backHtml });
        return { id: `pc_${mailed.length}` };
      }),
    },
    repo: {
      isSuppressed: vi.fn(async (b) => b.placeId === "sup"),
      isSeen: vi.fn(async (placeId) => placeId === "seen"),
      createProvisionalSite: vi.fn(async (b) => {
        created.push(b.placeId);
        return {
          tenantId: `t_${b.placeId}`,
          subdomain: b.placeId,
          previewUrl: `https://preview/${b.placeId}`,
          claimToken: `tok_${b.placeId}`,
        };
      }),
      recordProspect: vi.fn(async () => {}),
      markPostcardSent: vi.fn(async () => {}),
    },
    config: {
      provisionalHost: "preview.hoku.com",
      claimBaseUrl: "https://hoku.com/claim",
      fromAddress: { name: "HOKU Local Sites", line1: "500 Ala Moana", city: "Honolulu", state: "HI", zip: "96813" },
      maxPerBatch: 50,
    },
  };
  return { deps, created, mailed, screenshots };
}

describe("hasMailableAddress", () => {
  it("requires a complete street address", () => {
    expect(hasMailableAddress(businesses[0])).toBe(true);
    expect(hasMailableAddress(businesses[1])).toBe(false);
  });
});

describe("runBatch", () => {
  it("only generates + mails for eligible businesses; skips the rest BEFORE generation", async () => {
    const { deps, created, screenshots, mailed } = makeDeps();
    const results = await runBatch(deps, "coffee shops", "Kalihi, Honolulu");

    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName["Kalihi Coffee"].status).toBe("sent");
    expect(byName["No Address LLC"].skipped).toBe("no_mailable_address");
    expect(byName["Suppressed Co"].skipped).toBe("suppressed_or_seen");
    expect(byName["Already Seen"].skipped).toBe("suppressed_or_seen");

    // No provisional site / screenshot / postcard for skipped businesses.
    expect(created).toEqual(["good"]);
    expect(screenshots).toEqual(["t_good"]);
    expect(mailed).toHaveLength(1);
    expect(deps.repo.markPostcardSent).toHaveBeenCalledWith("tok_good", "pc_1");
  });

  it("mails a compliant postcard (offer, not a bill)", async () => {
    const { deps, mailed } = makeDeps();
    await runBatch(deps, "q", "loc");
    expect(postcardComplianceIssues(mailed[0].backHtml)).toEqual([]);
    expect(mailed[0].backHtml).toContain("This is not a bill");
    expect(mailed[0].backHtml).toContain("HOKU Local Sites"); // sender identity
  });
});

describe("provisional privacy guardrail", () => {
  it("provisional tenants are unpublished, unlisted, and not active", () => {
    expect(PROVISIONAL_TENANT_FLAGS).toEqual({
      status: "provisional",
      is_published: false,
      is_listed: false,
    });
  });
});
