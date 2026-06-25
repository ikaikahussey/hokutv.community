import type { Campaign, CampaignStatus, ServeContext } from "./types";
import { matchesTargeting } from "./targeting";

/** Default flat CPM (no bidding — build-prompt §8): $5 per 1000 impressions. */
export const DEFAULT_CPM_CENTS = 500;

export function remainingBudgetCents(c: Pick<Campaign, "budget_cents" | "spend_cents">): number {
  return Math.max(0, c.budget_cents - c.spend_cents);
}

export function isExhausted(c: Pick<Campaign, "budget_cents" | "spend_cents">): boolean {
  return remainingBudgetCents(c) <= 0;
}

/** Per-impression cost (rounded up so a campaign can't overspend by fractions). */
export function impressionCostCents(c: Pick<Campaign, "cpm_cents">): number {
  return Math.ceil((c.cpm_cents ?? DEFAULT_CPM_CENTS) / 1000);
}

/** Servable = approved/active AND has budget left. Pending/rejected/paused never serve. */
export function isServable(c: Campaign): boolean {
  return (c.status === "approved" || c.status === "active") && !isExhausted(c);
}

export function frequencyCapOk(seenCount: number, cap: number): boolean {
  return seenCount < cap;
}

export interface SelectOptions {
  /** How many times this viewer has already seen each campaign. */
  historyByCampaign?: Record<string, number>;
  frequencyCap?: number;
}

/**
 * Pick one ad for the context: filter to servable + targeted + under the
 * frequency cap, then favor the campaign with the most remaining budget
 * (simple pacing so spend spreads out). Returns null when nothing is eligible.
 */
export function selectAd(
  candidates: Campaign[],
  ctx: ServeContext,
  opts: SelectOptions = {}
): Campaign | null {
  const cap = opts.frequencyCap ?? Infinity;
  const history = opts.historyByCampaign ?? {};
  const eligible = candidates.filter(
    (c) =>
      isServable(c) &&
      matchesTargeting(c.targeting, ctx) &&
      frequencyCapOk(history[c.id] ?? 0, cap)
  );
  if (eligible.length === 0) return null;
  return eligible
    .slice()
    .sort((a, b) => remainingBudgetCents(b) - remainingBudgetCents(a))[0];
}

/**
 * Charge one impression against a campaign. When the budget is exhausted the
 * campaign auto-completes (paused) so it won't serve again.
 */
export function chargeImpression(c: Campaign): Campaign {
  const spend_cents = c.spend_cents + impressionCostCents(c);
  const next: Campaign = { ...c, spend_cents };
  const status: CampaignStatus = isExhausted(next) ? "completed" : next.status;
  return { ...next, status };
}
