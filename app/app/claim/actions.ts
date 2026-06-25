"use server";

import { claimSite, type ClaimRepo, type Prospect } from "@/lib/acq/claim";
import { verifySecondFactor, type Channel } from "@/lib/acq/verify";
import { isSupabaseConfigured } from "@/lib/supabase/public";

/**
 * Claim wizard server actions (acquisition-module.md §2/§5.5). Claiming is the
 * INBOUND half of the funnel — a business owner taking control of a provisional
 * site — so it's safe to build functionally; only OUTBOUND sending is
 * counsel-gated (COUNSEL.md). A claim still requires the postcard token AND a
 * verified second factor before any transfer (enforced by claimSite).
 *
 * Live OTP delivery (email/SMS) isn't wired (no provider; counsel-pending), so
 * the live path is a clearly-marked stub and the demo path is fully functional.
 */
const DEMO_TOKEN = "demo-postcard";
const DEMO_CODE = "424242";
const FOUNDER_CREDIT_CENTS = 2500;

/** In-memory repo for the demo claim — the live repo is Supabase service-role. */
function demoRepo(): ClaimRepo {
  const prospect: Prospect = {
    id: "prospect_demo",
    tenant_id: "t_demo_provisional",
    status: "postcard_sent",
    business_email: "owner@kalihi-coffee.example.com",
  };
  return {
    async findProspectByToken(token) {
      return token === DEMO_TOKEN ? prospect : null;
    },
    async activateTenant() {
      /* provisional → active + published (no-op in demo) */
    },
    async recordClaim() {
      /* records founder credit (no-op in demo) */
    },
    async invalidateToken() {
      prospect.status = "claimed"; // single-use
    },
  };
}

export interface StartClaimResult {
  ok: boolean;
  businessName?: string;
  /** Demo only: surfaced so the wizard is testable without an SMS/email send. */
  demoCode?: string;
  message: string;
}

export async function startClaim(token: string): Promise<StartClaimResult> {
  if (!isSupabaseConfigured()) {
    if (token.trim() !== DEMO_TOKEN) {
      return { ok: false, message: "We couldn't find that claim code — check your postcard." };
    }
    return {
      ok: true,
      businessName: "Kalihi Coffee",
      demoCode: DEMO_CODE,
      message: "Enter the 6-digit code to verify you own this business.",
    };
  }
  // Live OTP delivery is counsel-pending; the claim transfer logic is ready.
  return { ok: false, message: "Live claim verification isn't enabled yet — see COUNSEL.md." };
}

export interface FinishClaimResult {
  ok: boolean;
  tenantId?: string;
  published?: boolean;
  message: string;
}

export async function finishClaim(input: {
  token: string;
  channel: Channel;
  code: string;
}): Promise<FinishClaimResult> {
  if (!isSupabaseConfigured()) {
    if (input.token.trim() !== DEMO_TOKEN) {
      return { ok: false, message: "Invalid claim code." };
    }
    const verification = verifySecondFactor({
      channel: input.channel,
      expected: DEMO_CODE,
      provided: input.code,
    });
    if (!verification.verified) {
      return { ok: false, message: "That code didn't match — try again." };
    }
    try {
      const { tenantId } = await claimSite(demoRepo(), {
        token: input.token,
        verification,
        founderCreditCents: FOUNDER_CREDIT_CENTS,
        paid: false,
      });
      return {
        ok: true,
        tenantId,
        published: true,
        message: "Your site is live and a $25 founder credit was applied.",
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Claim failed." };
    }
  }
  return { ok: false, message: "Live claim isn't enabled yet — see COUNSEL.md." };
}
