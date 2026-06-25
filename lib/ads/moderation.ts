/**
 * Automated ad moderation (build-prompt §8). Cheap pre-checks before a human
 * queue: require an https destination and reject prohibited content. A rejected
 * campaign is auto-refunded its unspent budget via Stripe (refund amount here;
 * the Stripe call lives in the route/action).
 */
export interface ModerationInput {
  headline: string;
  subtext?: string;
  destination_url: string;
}

export interface ModerationResult {
  decision: "approved" | "rejected";
  reasons: string[];
}

const PROHIBITED: RegExp[] = [
  /\bcasino\b/i,
  /\bporn\b/i,
  /\bguns?\b/i,
  /\bweapons?\b/i,
  /\bcrypto\s*(scam|giveaway)\b/i,
];

export function moderateCreative(input: ModerationInput): ModerationResult {
  const reasons: string[] = [];
  if (!/^https:\/\//i.test(input.destination_url.trim())) {
    reasons.push("destination_url must be https");
  }
  const text = `${input.headline} ${input.subtext ?? ""}`;
  for (const re of PROHIBITED) {
    if (re.test(text)) reasons.push(`prohibited content matched ${re}`);
  }
  return { decision: reasons.length ? "rejected" : "approved", reasons };
}

/** Refund amount (cents) when a campaign is rejected — the unspent budget. */
export function refundForRejection(
  campaign: { budget_cents: number; spend_cents: number }
): number {
  return Math.max(0, campaign.budget_cents - campaign.spend_cents);
}
