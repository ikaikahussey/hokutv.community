import { NextRequest, NextResponse } from "next/server";
import type { ServeContext } from "@/lib/ads/types";
import { getServingData, chooseCreative, recordImpression } from "@/lib/ads/serving";
import { RateLimiter } from "@/lib/security/rate-limit";

// Per-process fixed-window limiter for the unauthenticated serving endpoint.
// Tunable via env; swap for a shared store when running multi-instance.
const limiter = new RateLimiter(Number(process.env.SERVE_RATE_LIMIT ?? 30), 10_000);

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

/**
 * Ad serving endpoint (ads.hoku.com/api/serve → rewritten to /ads/api/serve).
 * Filters by targeting + remaining budget + frequency cap, logs an impression,
 * and returns the on-brand creative token config. 204 when nothing matches.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = limiter.hit(clientKey(req), Date.now());
  const rlHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
  };
  if (!rl.allowed) {
    return new NextResponse("Too Many Requests", { status: 429, headers: rlHeaders });
  }

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
  if (!chosen) {
    return new NextResponse(null, { status: 204, headers: rlHeaders });
  }

  await recordImpression(chosen.campaign, ctx);

  return NextResponse.json(
    { campaignId: chosen.campaign.id, creative: chosen.variant },
    { headers: { ...rlHeaders, "cache-control": "no-store" } }
  );
}
