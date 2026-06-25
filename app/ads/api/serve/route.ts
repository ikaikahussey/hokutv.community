import { NextRequest, NextResponse } from "next/server";
import type { ServeContext } from "@/lib/ads/types";
import { getServingData, chooseCreative, recordImpression } from "@/lib/ads/serving";

/**
 * Ad serving endpoint (ads.hoku.com/api/serve → rewritten to /ads/api/serve).
 * Filters by targeting + remaining budget + frequency cap, logs an impression,
 * and returns the on-brand creative token config. 204 when nothing matches.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const ctx: ServeContext = {
    slot: sp.get("slot") ?? "sidebar",
    category: sp.get("category") ?? undefined,
    lat: sp.get("lat") ? Number(sp.get("lat")) : undefined,
    lng: sp.get("lng") ? Number(sp.get("lng")) : undefined,
    hostTenantId: sp.get("host") ?? undefined,
  };

  const data = await getServingData();
  const chosen = chooseCreative(data, ctx);
  if (!chosen) return new NextResponse(null, { status: 204 });

  await recordImpression(chosen.campaign, ctx);

  return NextResponse.json(
    { campaignId: chosen.campaign.id, creative: chosen.variant },
    { headers: { "cache-control": "no-store" } }
  );
}
