import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { matchesTargeting, haversineKm } from "@/lib/ads/targeting";
import {
  selectAd,
  chargeImpression,
  isServable,
  isExhausted,
} from "@/lib/ads/pacing";
import { rollupEvents, type AdEvent } from "@/lib/ads/rollups";
import { moderateCreative, refundForRejection } from "@/lib/ads/moderation";
import { generateVariants, renderAd } from "@/lib/ads/creative";
import type { Campaign } from "@/lib/ads/types";

const base = (over: Partial<Campaign> = {}): Campaign => ({
  id: "c1",
  tenant_id: "t1",
  creative_id: "cr1",
  status: "active",
  budget_cents: 1000,
  spend_cents: 0,
  targeting: {},
  ...over,
});

describe("targeting", () => {
  it("matches by category", () => {
    expect(matchesTargeting({ category: "coffee" }, { slot: "s", category: "coffee" })).toBe(true);
    expect(matchesTargeting({ category: "coffee" }, { slot: "s", category: "surf" })).toBe(false);
    expect(matchesTargeting({ category: "coffee" }, { slot: "s" })).toBe(false);
  });
  it("matches by geo radius", () => {
    const geo = { lat: 21.3, lng: -157.85, radiusKm: 10 };
    expect(matchesTargeting({ geo }, { slot: "s", lat: 21.31, lng: -157.86 })).toBe(true);
    expect(matchesTargeting({ geo }, { slot: "s", lat: 40.7, lng: -74 })).toBe(false);
    expect(matchesTargeting({ geo }, { slot: "s" })).toBe(false);
  });
  it("untargeted matches anything", () => {
    expect(matchesTargeting({}, { slot: "s" })).toBe(true);
  });
  it("haversine is ~0 for the same point", () => {
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBeCloseTo(0);
  });
});

describe("selection + pacing", () => {
  it("never serves an unapproved/paused/rejected campaign", () => {
    for (const status of ["pending", "rejected", "paused"] as const) {
      expect(isServable(base({ status }))).toBe(false);
      expect(selectAd([base({ status })], { slot: "s" })).toBeNull();
    }
  });
  it("serves an approved/active campaign with budget", () => {
    expect(selectAd([base({ status: "approved" })], { slot: "s" })?.id).toBe("c1");
  });
  it("excludes exhausted campaigns and prefers the most remaining budget", () => {
    const poor = base({ id: "poor", budget_cents: 100, spend_cents: 90 });
    const rich = base({ id: "rich", budget_cents: 1000, spend_cents: 0 });
    const broke = base({ id: "broke", budget_cents: 100, spend_cents: 100 });
    expect(selectAd([poor, rich, broke], { slot: "s" })?.id).toBe("rich");
    expect(isExhausted(broke)).toBe(true);
  });
  it("respects the frequency cap", () => {
    expect(
      selectAd([base()], { slot: "s" }, { historyByCampaign: { c1: 3 }, frequencyCap: 3 })
    ).toBeNull();
  });
  it("budget draw-down pauses the campaign at exhaustion", () => {
    let c = base({ budget_cents: 1 }); // one impression exhausts it
    c = chargeImpression(c);
    expect(c.spend_cents).toBe(1);
    expect(c.status).toBe("completed");
    expect(selectAd([c], { slot: "s" })).toBeNull();
  });
});

describe("rollups", () => {
  it("hourly rollups match raw event counts", () => {
    const events: AdEvent[] = [
      { campaign_id: "c1", host_tenant_id: "h1", type: "impression", created_at: "2026-06-25T10:05:00Z" },
      { campaign_id: "c1", host_tenant_id: "h1", type: "impression", created_at: "2026-06-25T10:55:00Z" },
      { campaign_id: "c1", host_tenant_id: "h1", type: "click", created_at: "2026-06-25T10:30:00Z" },
      { campaign_id: "c1", host_tenant_id: "h1", type: "impression", created_at: "2026-06-25T11:00:00Z" },
    ];
    const rollups = rollupEvents(events);
    const totalImpr = rollups.reduce((n, r) => n + r.impressions, 0);
    const totalClicks = rollups.reduce((n, r) => n + r.clicks, 0);
    expect(totalImpr).toBe(events.filter((e) => e.type === "impression").length);
    expect(totalClicks).toBe(events.filter((e) => e.type === "click").length);
    // Two distinct hour buckets (10:00 and 11:00).
    expect(new Set(rollups.map((r) => r.hour)).size).toBe(2);
  });
});

describe("moderation + auto-refund", () => {
  it("approves clean https creatives", () => {
    expect(
      moderateCreative({ headline: "Best coffee", destination_url: "https://x.com" }).decision
    ).toBe("approved");
  });
  it("rejects prohibited content and non-https destinations", () => {
    expect(
      moderateCreative({ headline: "Casino night", destination_url: "https://x.com" }).decision
    ).toBe("rejected");
    expect(
      moderateCreative({ headline: "Coffee", destination_url: "http://x.com" }).decision
    ).toBe("rejected");
  });
  it("refunds the unspent budget on rejection", () => {
    expect(refundForRejection({ budget_cents: 5000, spend_cents: 1200 })).toBe(3800);
    expect(refundForRejection({ budget_cents: 5000, spend_cents: 0 })).toBe(5000);
  });
});

describe("creative (on-brand, token-driven)", () => {
  const brand = { "--brand-600": "#123456", "--brand-foreground": "#ffffff" };
  it("produces multiple variants from one input", () => {
    expect(generateVariants({ headline: "Hi", cta: "Go", url: "https://x" }, brand)).toHaveLength(3);
  });
  it("renders on-brand with tokens, not hardcoded color classes", () => {
    const [v] = generateVariants(
      { headline: "Fresh Brew", offer: "10% off", cta: "Order", url: "https://x" },
      brand
    );
    const html = renderToStaticMarkup(renderAd(v));
    expect(html).toContain("Fresh Brew");
    expect(html).toContain("Order");
    expect(html).toMatch(/brand-/); // token-driven classes
    // brand var values are applied via the wrapper style, not literal classes
    expect(html).toContain("--brand-600:#123456");
  });
});
