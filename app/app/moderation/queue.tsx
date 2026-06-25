"use client";

import { useState, useTransition } from "react";
import type { QueueItem } from "@/lib/ads/review";
import { autoFlagsFor } from "@/lib/ads/review";
import { decideCampaign, type DecideResult } from "./actions";

interface RowState {
  item: QueueItem;
  result?: DecideResult;
  pending?: boolean;
}

export function ModerationQueue({ initial }: { initial: QueueItem[] }) {
  const [rows, setRows] = useState<RowState[]>(initial.map((item) => ({ item })));
  const [, startTransition] = useTransition();

  function decide(idx: number, decision: "approve" | "reject") {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, pending: true } : r)));
    startTransition(async () => {
      try {
        const result = await decideCampaign(rows[idx].item, decision);
        setRows((rs) =>
          rs.map((r, i) => (i === idx ? { ...r, result, pending: false } : r))
        );
      } catch {
        // Clear the pending state so the admin can retry the decision.
        setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, pending: false } : r)));
      }
    });
  }

  if (initial.length === 0) {
    return (
      <p data-testid="queue-empty" className="mt-8 text-ink/60">
        Nothing waiting for review. 🎉
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-4" data-testid="moderation-queue">
      {rows.map((r, i) => {
        const flags = autoFlagsFor(r.item.creative);
        return (
          <li
            key={r.item.campaign.id}
            data-testid={`mod-row-${r.item.campaign.id}`}
            className="rounded-lg border border-brand-100 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-heading font-semibold text-ink">
                  {r.item.creative.headline}
                </p>
                <p className="text-xs text-ink/60">
                  {r.item.creative.destination_url} · budget $
                  {(r.item.campaign.budget_cents / 100).toFixed(2)}
                </p>
                {flags.length > 0 && (
                  <ul data-testid="auto-flags" className="mt-2 text-xs text-red-600">
                    {flags.map((f) => (
                      <li key={f}>⚠ {f}</li>
                    ))}
                  </ul>
                )}
              </div>
              {r.result ? (
                <span
                  data-testid="decision"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    r.result.campaignStatus === "approved"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.result.campaignStatus}
                </span>
              ) : (
                <span className="flex gap-2">
                  <button
                    type="button"
                    data-testid="approve"
                    disabled={r.pending}
                    onClick={() => decide(i, "approve")}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    data-testid="reject"
                    disabled={r.pending}
                    onClick={() => decide(i, "reject")}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </span>
              )}
            </div>
            {r.result && (
              <p data-testid="decision-message" className="mt-2 text-xs text-ink/60">
                {r.result.message}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
