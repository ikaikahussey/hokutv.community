import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { buildThemeVars, colorFromSeed, DEFAULT_THEME_INPUT } from "@/lib/theme/tokens";
import type { Campaign, Creative, ServeContext } from "./types";
import { selectAd, chargeImpression } from "./pacing";
import { generateVariants, type CreativeVariant } from "./creative";

export interface ServingData {
  campaigns: Campaign[];
  creatives: Record<string, Creative>;
}

function demoServingData(): ServingData {
  const brand = buildThemeVars({ ...DEFAULT_THEME_INPUT, primary: colorFromSeed("demo-ad") });
  const creative: Creative = {
    id: "cr_demo",
    tenant_id: "t_demo",
    headline: "Try Kalihi Coffee",
    subtext: "10% off your first order",
    cta_label: "Order now",
    destination_url: "https://kalihi-coffee.hokusites.com",
    layout_variant: "a",
    brand_snapshot: brand,
    status: "approved",
  };
  const campaign: Campaign = {
    id: "cmp_demo",
    tenant_id: "t_demo",
    creative_id: "cr_demo",
    status: "active",
    budget_cents: 10000,
    spend_cents: 0,
    targeting: {}, // matches any context
  };
  return { campaigns: [campaign], creatives: { cr_demo: creative } };
}

export async function getServingData(): Promise<ServingData> {
  if (!isSupabaseConfigured()) return demoServingData();
  const db = createSupabaseServiceClient();
  const { data: camps } = await db
    .from("ad_campaigns")
    .select("*")
    .in("status", ["approved", "active"]);
  const campaigns = (camps ?? []) as Campaign[];
  const ids = campaigns.map((c) => c.creative_id);
  const { data: crs } = await db
    .from("ad_creatives")
    .select("*")
    .in("id", ids)
    .eq("status", "approved");
  const creatives: Record<string, Creative> = {};
  for (const c of (crs ?? []) as Creative[]) creatives[c.id] = c;
  // Drop campaigns whose creative isn't approved.
  return { campaigns: campaigns.filter((c) => creatives[c.creative_id]), creatives };
}

export async function recordImpression(campaign: Campaign, ctx: ServeContext): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const db = createSupabaseServiceClient();
  await db.from("ad_events").insert({
    campaign_id: campaign.id,
    host_tenant_id: ctx.hostTenantId ?? null,
    slot: ctx.slot,
    type: "impression",
    context_json: { category: ctx.category ?? null },
  });
  const charged = chargeImpression(campaign);
  await db
    .from("ad_campaigns")
    .update({ spend_cents: charged.spend_cents, status: charged.status })
    .eq("id", campaign.id);
}

/** Select + build the on-brand creative variant to serve, or null. */
export function chooseCreative(
  data: ServingData,
  ctx: ServeContext,
  opts?: { historyByCampaign?: Record<string, number>; frequencyCap?: number }
): { campaign: Campaign; variant: CreativeVariant } | null {
  const campaign = selectAd(data.campaigns, ctx, opts);
  if (!campaign) return null;
  const creative = data.creatives[campaign.creative_id];
  if (!creative) return null;
  const [variant] = generateVariants(
    {
      headline: creative.headline,
      offer: creative.subtext,
      cta: creative.cta_label,
      url: creative.destination_url,
    },
    creative.brand_snapshot
  );
  return { campaign, variant };
}
