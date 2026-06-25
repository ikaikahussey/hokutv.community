import type { Geo, Targeting } from "./types";
import { moderateCreative } from "./moderation";
import { findPackage, type AdPackage } from "./packages";

/**
 * The buying wizard's accumulated input (build-prompt §8): Creative → Targeting
 * → Budget. Kept as a plain serializable object so the wizard logic is pure and
 * unit-testable independent of React, and so a draft can round-trip through a
 * server action / Stripe checkout untouched.
 */
export interface AdDraft {
  headline: string;
  offer?: string;
  cta: string;
  url: string;
  category?: string;
  geo?: Geo;
  packageId: string;
}

export interface DraftValidation {
  ok: boolean;
  errors: string[];
}

export function emptyDraft(): AdDraft {
  return { headline: "", cta: "Learn more", url: "", packageId: "" };
}

/**
 * Validate a draft before pay/submit. Reuses the same automated moderation the
 * serving path trusts (https + prohibited-content), so a draft that would be
 * auto-rejected can't be paid for in the first place.
 */
export function validateDraft(d: AdDraft): DraftValidation {
  const errors: string[] = [];
  if (!d.headline.trim()) errors.push("Headline is required");
  if (!d.cta.trim()) errors.push("Call-to-action is required");
  if (!findPackage(d.packageId)) errors.push("Choose a package");
  if (d.geo && (d.geo.radiusKm <= 0 || !Number.isFinite(d.geo.radiusKm))) {
    errors.push("Geo radius must be positive");
  }
  const mod = moderateCreative({
    headline: d.headline,
    subtext: d.offer,
    destination_url: d.url,
  });
  if (mod.decision === "rejected") errors.push(...mod.reasons);
  return { ok: errors.length === 0, errors };
}

export function draftTargeting(d: AdDraft): Targeting {
  const t: Targeting = {};
  if (d.category) t.category = d.category;
  if (d.geo) t.geo = d.geo;
  return t;
}

export interface CampaignDraftInput {
  headline: string;
  subtext?: string;
  cta_label: string;
  destination_url: string;
  package: string;
  budget_cents: number;
  targeting: Targeting;
}

/**
 * Turn a validated draft into the creative + campaign fields persisted on
 * submit. Budget comes from the chosen package's price (prepaid, flat).
 */
export function draftToCampaignInput(
  d: AdDraft,
  p: AdPackage = findPackage(d.packageId)!
): CampaignDraftInput {
  return {
    headline: d.headline.trim(),
    subtext: d.offer?.trim() || undefined,
    cta_label: d.cta.trim(),
    destination_url: d.url.trim(),
    package: p.id,
    budget_cents: p.priceCents,
    targeting: draftTargeting(d),
  };
}
