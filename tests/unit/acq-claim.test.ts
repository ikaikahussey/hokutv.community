import { describe, it, expect, vi } from "vitest";
import {
  claimSite,
  VerificationRequiredError,
  TokenInvalidError,
  type ClaimRepo,
  type Prospect,
} from "@/lib/acq/claim";

function makeRepo(prospect: Prospect | null) {
  const calls = { activate: 0, claim: 0, invalidate: 0 };
  const repo: ClaimRepo = {
    findProspectByToken: vi.fn(async () => prospect),
    activateTenant: vi.fn(async () => {
      calls.activate++;
    }),
    recordClaim: vi.fn(async () => {
      calls.claim++;
    }),
    invalidateToken: vi.fn(async () => {
      calls.invalidate++;
    }),
  };
  return { repo, calls };
}

const prospect: Prospect = {
  id: "p1",
  tenant_id: "t1",
  status: "postcard_sent",
  business_email: "owner@biz.com",
};

describe("claimSite ownership verification (anti-abuse)", () => {
  it("refuses to transfer without a verified second factor", async () => {
    const { repo, calls } = makeRepo(prospect);
    await expect(
      claimSite(repo, { token: "tok", verification: { verified: false, via: null } })
    ).rejects.toThrow(VerificationRequiredError);
    expect(calls.activate).toBe(0); // no transfer happened
  });

  it("transfers on verified claim and records the claim", async () => {
    const { repo, calls } = makeRepo(prospect);
    const res = await claimSite(repo, {
      token: "tok",
      verification: { verified: true, via: "email" },
      founderCreditCents: 5000,
      paid: true,
    });
    expect(res.tenantId).toBe("t1");
    expect(calls.activate).toBe(1);
    expect(calls.claim).toBe(1);
    expect(calls.invalidate).toBe(1);
    expect(repo.recordClaim).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedVia: "email", founderCreditCents: 5000, paid: true })
    );
  });

  it("rejects an unknown token", async () => {
    const { repo } = makeRepo(null);
    await expect(
      claimSite(repo, { token: "nope", verification: { verified: true, via: "email" } })
    ).rejects.toThrow(TokenInvalidError);
  });

  it("rejects replay of an already-claimed token (single-use)", async () => {
    const { repo, calls } = makeRepo({ ...prospect, status: "claimed" });
    await expect(
      claimSite(repo, { token: "tok", verification: { verified: true, via: "email" } })
    ).rejects.toThrow(TokenInvalidError);
    expect(calls.activate).toBe(0);
  });
});
