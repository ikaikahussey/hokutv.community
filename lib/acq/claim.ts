/**
 * Claim + ownership verification (acquisition-module.md §2/§5.5, Phase B/C).
 * Minimal, counsel-review-pending: a claim requires the postcard token AND a
 * second factor (verified business email or phone OTP) before any transfer, and
 * the token is single-use. Founder credit + publish-on-claim are Phase C.
 */
export class VerificationRequiredError extends Error {
  constructor(message = "Ownership verification required before transfer") {
    super(message);
    this.name = "VerificationRequiredError";
  }
}
export class TokenInvalidError extends Error {
  constructor(message = "Invalid or already-used claim token") {
    super(message);
    this.name = "TokenInvalidError";
  }
}

export interface Prospect {
  id: string;
  tenant_id: string;
  status: "site_generated" | "postcard_sent" | "claimed" | "rejected";
  business_email?: string;
}

export interface VerificationResult {
  verified: boolean;
  via: "email" | "phone" | null;
}

export interface ClaimRepo {
  findProspectByToken(token: string): Promise<Prospect | null>;
  activateTenant(tenantId: string): Promise<void>; // provisional → active + publish
  recordClaim(input: {
    prospectId: string;
    tenantId: string;
    verifiedVia: "email" | "phone";
    founderCreditCents: number;
    paid: boolean;
  }): Promise<void>;
  invalidateToken(token: string): Promise<void>; // mark prospect claimed (single-use)
}

export interface ClaimInput {
  token: string;
  verification: VerificationResult;
  founderCreditCents?: number;
  paid?: boolean;
}

export async function claimSite(
  repo: ClaimRepo,
  { token, verification, founderCreditCents = 0, paid = false }: ClaimInput
): Promise<{ tenantId: string }> {
  const prospect = await repo.findProspectByToken(token);
  if (!prospect) throw new TokenInvalidError("Unknown claim token");
  if (prospect.status === "claimed") throw new TokenInvalidError(); // single-use

  if (!verification?.verified || !verification.via) {
    throw new VerificationRequiredError();
  }

  await repo.activateTenant(prospect.tenant_id);
  await repo.recordClaim({
    prospectId: prospect.id,
    tenantId: prospect.tenant_id,
    verifiedVia: verification.via,
    founderCreditCents,
    paid,
  });
  await repo.invalidateToken(token);

  return { tenantId: prospect.tenant_id };
}
