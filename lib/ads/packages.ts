import type { Targeting } from "./types";
import { DEFAULT_CPM_CENTS } from "./pacing";

/**
 * Flat, prepaid ad packages (build-prompt §8 — "flat prepaid packages,
 * estimated reach, no bidding"). A package is just a budget at the fixed CPM;
 * impressions and an estimated reach are derived so the buyer sees plain numbers
 * instead of an auction.
 */
export interface AdPackage {
  id: string;
  label: string;
  priceCents: number;
  /** Impressions the budget buys at the flat CPM. */
  impressions: number;
}

/** Average times one person sees a campaign (frequency cap territory). */
export const AVG_FREQUENCY = 3;

/** Rough urban population density used to sanity-cap a small-radius estimate. */
export const POP_DENSITY_PER_KM2 = 1500;

function pkg(id: string, label: string, priceCents: number): AdPackage {
  return {
    id,
    label,
    priceCents,
    impressions: Math.floor((priceCents / DEFAULT_CPM_CENTS) * 1000),
  };
}

export const AD_PACKAGES: AdPackage[] = [
  pkg("starter", "Starter", 2500),
  pkg("growth", "Growth", 7500),
  pkg("reach", "Reach", 20000),
];

export function findPackage(id: string): AdPackage | undefined {
  return AD_PACKAGES.find((p) => p.id === id);
}

/** Upper bound on distinct people in a geo-targeted radius (πr² × density). */
export function audienceCeiling(t: Targeting): number | null {
  if (!t.geo) return null;
  return Math.round(Math.PI * t.geo.radiusKm ** 2 * POP_DENSITY_PER_KM2);
}

/**
 * Estimated unique reach for a package under some targeting. Base reach is
 * impressions / average frequency; a tight geo radius caps it by the people who
 * actually live there, so a buyer isn't promised more audience than exists.
 */
export function estimateReach(p: AdPackage, t: Targeting = {}): number {
  const base = Math.round(p.impressions / AVG_FREQUENCY);
  const ceiling = audienceCeiling(t);
  return ceiling == null ? base : Math.min(base, ceiling);
}
