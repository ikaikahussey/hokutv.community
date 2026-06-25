import { describe, it, expect } from "vitest";
import {
  AD_PACKAGES,
  findPackage,
  estimateReach,
  audienceCeiling,
  AVG_FREQUENCY,
} from "@/lib/ads/packages";
import {
  emptyDraft,
  validateDraft,
  draftToCampaignInput,
  draftTargeting,
  type AdDraft,
} from "@/lib/ads/draft";
import {
  localCopySuggestions,
  parseSuggestion,
  anthropicCopyGenerator,
  suggestCopy,
  type CopyGenerator,
} from "@/lib/ads/copy";
import { applyDecision, pendingQueue, autoFlagsFor } from "@/lib/ads/review";
import {
  effectiveParticipation,
  toggleSlot,
  isSlotEnabled,
  AD_SLOTS,
} from "@/lib/ads/participation";
import { selectAd } from "@/lib/ads/pacing";
import type { Campaign, Creative } from "@/lib/ads/types";

const validDraft = (over: Partial<AdDraft> = {}): AdDraft => ({
  headline: "Fresh Kona Brew",
  offer: "10% off",
  cta: "Order now",
  url: "https://kona.example.com",
  packageId: "growth",
  ...over,
});

describe("ad packages", () => {
  it("derives impressions from a flat CPM (no bidding)", () => {
    const starter = findPackage("starter")!;
    // $25 at $5 CPM => 5000 impressions
    expect(starter.impressions).toBe(5000);
    expect(AD_PACKAGES).toHaveLength(3);
  });
  it("estimates reach as impressions / average frequency when untargeted", () => {
    const growth = findPackage("growth")!;
    expect(estimateReach(growth)).toBe(Math.round(growth.impressions / AVG_FREQUENCY));
  });
  it("caps reach by the people a tight radius can hold", () => {
    const reach = findPackage("reach")!;
    const tiny = { geo: { lat: 21.3, lng: -157.8, radiusKm: 0.5 } };
    expect(audienceCeiling(tiny)).toBeLessThan(reach.impressions / AVG_FREQUENCY);
    expect(estimateReach(reach, tiny)).toBe(audienceCeiling(tiny));
  });
});

describe("ad draft validation", () => {
  it("accepts a clean draft and maps it to creative + campaign fields", () => {
    const d = validDraft();
    expect(validateDraft(d).ok).toBe(true);
    const input = draftToCampaignInput(d);
    expect(input.budget_cents).toBe(findPackage("growth")!.priceCents);
    expect(input.package).toBe("growth");
    expect(input.cta_label).toBe("Order now");
  });
  it("rejects missing fields, bad package, and non-https / prohibited content", () => {
    expect(validateDraft(emptyDraft()).ok).toBe(false);
    expect(validateDraft(validDraft({ packageId: "nope" })).errors).toContain("Choose a package");
    expect(validateDraft(validDraft({ url: "http://x.com" })).ok).toBe(false);
    expect(validateDraft(validDraft({ headline: "Casino night" })).ok).toBe(false);
  });
  it("carries category + geo into targeting", () => {
    const t = draftTargeting(validDraft({ category: "coffee", geo: { lat: 1, lng: 2, radiusKm: 5 } }));
    expect(t.category).toBe("coffee");
    expect(t.geo?.radiusKm).toBe(5);
  });
});

describe("ad copy suggestions", () => {
  it("local fallback yields three headlines and CTAs without network", () => {
    const s = localCopySuggestions({ businessName: "Kona Coffee", category: "coffee", offer: "10% off" });
    expect(s.headlines).toHaveLength(3);
    expect(s.ctas).toHaveLength(3);
    expect(s.headlines.join(" ")).toContain("Kona Coffee");
  });
  it("parseSuggestion guards malformed model output", () => {
    expect(parseSuggestion({ headlines: ["a"], ctas: ["b"] })).not.toBeNull();
    expect(parseSuggestion({ headlines: "a", ctas: [] })).toBeNull();
    expect(parseSuggestion("nope")).toBeNull();
  });
  it("anthropic generator parses a Messages-API response via injected fetch", async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          content: [{ text: 'Here you go: {"headlines":["A","B","C"],"ctas":["X","Y","Z"]}' }],
        }),
        { status: 200 }
      )) as unknown as typeof fetch;
    const gen = anthropicCopyGenerator({ apiKey: "k", fetchImpl: fakeFetch });
    const out = await suggestCopy({ businessName: "Kona" }, gen);
    expect(out.headlines).toEqual(["A", "B", "C"]);
  });
  it("falls back to local copy when the generator throws", async () => {
    const boom: CopyGenerator = async () => {
      throw new Error("503");
    };
    const out = await suggestCopy({ businessName: "Kona" }, boom);
    expect(out.headlines).toHaveLength(3); // local fallback
  });
});

describe("moderation review (approve / reject + auto-refund)", () => {
  const creative: Creative = {
    id: "cr1",
    tenant_id: "t1",
    headline: "Best Coffee",
    cta_label: "Order",
    destination_url: "https://x.com",
    layout_variant: "a",
    brand_snapshot: {},
    status: "pending",
  };
  const campaign: Campaign = {
    id: "cmp1",
    tenant_id: "t1",
    creative_id: "cr1",
    status: "pending",
    budget_cents: 7500,
    spend_cents: 0,
    targeting: {},
  };
  it("approve flips both statuses, no refund", () => {
    const out = applyDecision({ campaign, creative }, "approve");
    expect(out.campaignStatus).toBe("approved");
    expect(out.creativeStatus).toBe("approved");
    expect(out.refundCents).toBe(0);
  });
  it("reject refunds the unspent budget", () => {
    const out = applyDecision({ campaign: { ...campaign, spend_cents: 500 }, creative }, "reject");
    expect(out.campaignStatus).toBe("rejected");
    expect(out.refundCents).toBe(7000);
  });
  it("surfaces automated flags for risky creatives", () => {
    expect(autoFlagsFor({ ...creative, headline: "Casino night" }).length).toBeGreaterThan(0);
  });
  it("queue holds only pending campaigns", () => {
    const items = [
      { campaign, creative },
      { campaign: { ...campaign, id: "c2", status: "approved" as const }, creative },
    ];
    expect(pendingQueue(items)).toHaveLength(1);
  });
  it("a submitted-but-unapproved campaign never serves", () => {
    expect(selectAd([campaign], { slot: "sidebar" })).toBeNull();
  });
});

describe("host participation (default opt-in)", () => {
  it("unsaved slots default to enabled", () => {
    const rows = effectiveParticipation([]);
    expect(rows).toHaveLength(AD_SLOTS.length);
    expect(rows.every((r) => r.enabled)).toBe(true);
    expect(isSlotEnabled([], "sidebar")).toBe(true);
  });
  it("explicit opt-out overrides the default and toggles back", () => {
    const saved = [{ slotId: "footer", enabled: false }];
    const rows = effectiveParticipation(saved);
    expect(isSlotEnabled(rows, "footer")).toBe(false);
    const toggled = toggleSlot(rows, "footer");
    expect(isSlotEnabled(toggled, "footer")).toBe(true);
  });
});
