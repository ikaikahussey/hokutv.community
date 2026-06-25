"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import {
  suggestCopy,
  anthropicCopyGenerator,
  type CopyContext,
  type CopySuggestion,
} from "@/lib/ads/copy";
import {
  validateDraft,
  draftToCampaignInput,
  type AdDraft,
} from "@/lib/ads/draft";
import { findPackage } from "@/lib/ads/packages";

/** Copy suggestions for the creative step — Anthropic when keyed, else local. */
export async function suggestAdCopy(ctx: CopyContext): Promise<CopySuggestion> {
  const key = process.env.ANTHROPIC_API_KEY;
  const gen = key ? anthropicCopyGenerator({ apiKey: key }) : undefined;
  return suggestCopy(ctx, gen);
}

export interface SubmitResult {
  ok: boolean;
  message: string;
  campaignId?: string;
  status?: string;
  /** Stripe Checkout URL when payment is required (live mode). */
  checkoutUrl?: string;
}

/**
 * Persist a campaign from the wizard: create the creative + campaign as
 * `pending` (RLS scopes them to the buyer's tenant), then hand off to payment.
 * In demo mode (no Supabase) it returns a simulated confirmation so the wizard
 * is end-to-end testable without external services. The campaign is never
 * `approved` here — that only happens through the moderation queue.
 */
export async function submitCampaign(draft: AdDraft): Promise<SubmitResult> {
  const v = validateDraft(draft);
  if (!v.ok) return { ok: false, message: v.errors.join("; ") };

  const pkg = findPackage(draft.packageId)!;
  const input = draftToCampaignInput(draft, pkg);

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      status: "pending",
      campaignId: `cmp_demo_${draft.packageId}`,
      message:
        "Submitted for review (demo mode). Configure Stripe + Supabase to take payment and persist.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: me } = await supabase
    .from("users")
    .select("tenant_id")
    .maybeSingle();
  const tenantId = (me as { tenant_id: string | null } | null)?.tenant_id;
  if (!tenantId) return { ok: false, message: "No tenant for current user." };

  const { data: creative, error: ce } = await supabase
    .from("ad_creatives")
    .insert({
      tenant_id: tenantId,
      headline: input.headline,
      subtext: input.subtext ?? null,
      cta_label: input.cta_label,
      destination_url: input.destination_url,
      status: "pending",
    })
    .select("id")
    .single();
  if (ce || !creative) return { ok: false, message: "Could not save creative." };

  const { data: campaign, error: cae } = await supabase
    .from("ad_campaigns")
    .insert({
      tenant_id: tenantId,
      creative_id: (creative as { id: string }).id,
      package: input.package,
      targeting_json: input.targeting,
      budget_cents: input.budget_cents,
      status: "pending",
    })
    .select("id")
    .single();
  if (cae || !campaign) return { ok: false, message: "Could not save campaign." };

  return {
    ok: true,
    status: "pending",
    campaignId: (campaign as { id: string }).id,
    message: "Campaign submitted for review.",
  };
}
