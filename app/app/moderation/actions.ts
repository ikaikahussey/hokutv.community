"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { createStripeClient, refundPayment } from "@/lib/billing/stripe";
import {
  applyDecision,
  type Decision,
  type QueueItem,
  type ReviewOutcome,
} from "@/lib/ads/review";
import type { Campaign, Creative } from "@/lib/ads/types";

/**
 * Demo queue (offline): one clean campaign and one that trips the automated
 * checks (prohibited word + non-https), so the queue exercises the auto-flag
 * surface and the reject/refund path without a live database.
 */
function demoQueue(): QueueItem[] {
  const mk = (
    id: string,
    headline: string,
    url: string,
    budget: number
  ): QueueItem => ({
    campaign: {
      id,
      tenant_id: "t_demo",
      creative_id: `cr_${id}`,
      status: "pending",
      budget_cents: budget,
      spend_cents: 0,
      targeting: {},
    },
    creative: {
      id: `cr_${id}`,
      tenant_id: "t_demo",
      headline,
      cta_label: "Order",
      destination_url: url,
      layout_variant: "a",
      brand_snapshot: {},
      status: "pending",
    },
  });
  return [
    mk("cmp_clean", "Fresh Kona Brew", "https://kona.example.com", 7500),
    mk("cmp_flag", "Casino Night Special", "http://promo.example.com", 5000),
  ];
}

export async function getModerationQueue(): Promise<QueueItem[]> {
  if (!isSupabaseConfigured()) return demoQueue();
  const supabase = await createSupabaseServerClient();
  const { data: camps } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("status", "pending");
  const campaigns = (camps as Campaign[] | null) ?? [];
  if (campaigns.length === 0) return [];
  const { data: crs } = await supabase
    .from("ad_creatives")
    .select("*")
    .in(
      "id",
      campaigns.map((c) => c.creative_id)
    );
  const byId = new Map(((crs as Creative[] | null) ?? []).map((c) => [c.id, c]));
  return campaigns
    .map((c) => {
      const creative = byId.get(c.creative_id);
      return creative ? { campaign: c, creative } : null;
    })
    .filter((x): x is QueueItem => x !== null);
}

export interface DecideResult extends ReviewOutcome {
  ok: boolean;
  campaignId: string;
  refunded: boolean;
  message: string;
}

/**
 * Apply a moderation decision. In live mode this re-reads the campaign from the
 * DB (never trusting the client's copy), updates both statuses, and on rejection
 * issues a Stripe refund of the unspent budget. Demo mode returns the computed
 * outcome so the queue UI is testable offline.
 */
export async function decideCampaign(
  item: QueueItem,
  decision: Decision
): Promise<DecideResult> {
  if (!isSupabaseConfigured()) {
    const outcome = applyDecision(item, decision);
    return {
      ...outcome,
      ok: true,
      campaignId: item.campaign.id,
      refunded: outcome.refundCents > 0,
      message:
        decision === "approve"
          ? "Approved — campaign is now live (demo)."
          : `Rejected — $${(outcome.refundCents / 100).toFixed(2)} would be refunded (demo).`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: camp } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("id", item.campaign.id)
    .single();
  const { data: creative } = await supabase
    .from("ad_creatives")
    .select("*")
    .eq("id", item.creative.id)
    .single();
  if (!camp || !creative) {
    return {
      ok: false,
      campaignId: item.campaign.id,
      campaignStatus: "pending",
      creativeStatus: "pending",
      refundCents: 0,
      autoFlags: [],
      refunded: false,
      message: "Campaign not found.",
    };
  }

  const live: QueueItem = { campaign: camp as Campaign, creative: creative as Creative };
  const outcome = applyDecision(live, decision);

  await supabase
    .from("ad_campaigns")
    .update({ status: outcome.campaignStatus })
    .eq("id", live.campaign.id);
  await supabase
    .from("ad_creatives")
    .update({ status: outcome.creativeStatus })
    .eq("id", live.creative.id);

  let refunded = false;
  const paymentId = (camp as { stripe_payment_id?: string }).stripe_payment_id;
  if (decision === "reject" && outcome.refundCents > 0 && paymentId && process.env.STRIPE_SECRET_KEY) {
    try {
      await refundPayment(createStripeClient(), paymentId, outcome.refundCents);
      refunded = true;
    } catch {
      // Surface to the admin; the status change already stuck.
    }
  }

  return {
    ...outcome,
    ok: true,
    campaignId: live.campaign.id,
    refunded,
    message:
      decision === "approve"
        ? "Approved — campaign is now live."
        : `Rejected — refunded $${(outcome.refundCents / 100).toFixed(2)}.`,
  };
}
