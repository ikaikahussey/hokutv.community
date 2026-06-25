import type { Campaign, CampaignStatus, Creative } from "./types";
import { moderateCreative } from "./moderation";
import { refundForRejection } from "./moderation";

/**
 * Manual moderation queue logic (build-prompt §8). A platform admin approves or
 * rejects a pending campaign; rejection auto-refunds the unspent budget (the
 * Stripe call is made by the action — this returns the amount). Reuses the same
 * automated checks so the human queue can surface why something is risky.
 */
export interface QueueItem {
  campaign: Campaign;
  creative: Creative;
}

export type Decision = "approve" | "reject";

export interface ReviewOutcome {
  campaignStatus: CampaignStatus;
  creativeStatus: Creative["status"];
  refundCents: number;
  /** Automated reasons, surfaced to the admin (empty when clean). */
  autoFlags: string[];
}

export function autoFlagsFor(creative: Creative): string[] {
  return moderateCreative({
    headline: creative.headline,
    subtext: creative.subtext,
    destination_url: creative.destination_url,
  }).reasons;
}

export function applyDecision(item: QueueItem, decision: Decision): ReviewOutcome {
  const autoFlags = autoFlagsFor(item.creative);
  if (decision === "approve") {
    return {
      campaignStatus: "approved",
      creativeStatus: "approved",
      refundCents: 0,
      autoFlags,
    };
  }
  return {
    campaignStatus: "rejected",
    creativeStatus: "rejected",
    refundCents: refundForRejection(item.campaign),
    autoFlags,
  };
}

/** Only pending campaigns belong in the queue. */
export function pendingQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.campaign.status === "pending");
}
