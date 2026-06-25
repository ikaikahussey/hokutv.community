"use client";

import { useState, useTransition } from "react";
import {
  AD_SLOTS,
  effectiveParticipation,
  toggleSlot,
  type ParticipationRow,
} from "@/lib/ads/participation";
import { saveParticipation, type SaveParticipationResult } from "./actions";

export default function ParticipationPage() {
  // No saved rows here → everything defaults to opted-in.
  const [rows, setRows] = useState<ParticipationRow[]>(effectiveParticipation([]));
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<SaveParticipationResult | null>(null);

  const label = (slotId: string) =>
    AD_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <h1 className="font-heading text-2xl font-bold text-ink">Ad participation</h1>
      <p className="mt-1 text-sm text-ink/60">
        Choose which slots on your site may show HOKU network ads. You&apos;re
        opted in by default and earn a share of impressions you host.
      </p>

      <ul className="mt-6 flex flex-col gap-2" data-testid="participation">
        {rows.map((r) => (
          <li
            key={r.slotId}
            className="flex items-center justify-between rounded-md border border-brand-100 px-4 py-3"
          >
            <span className="font-medium text-ink">{label(r.slotId)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={r.enabled}
              data-testid={`slot-${r.slotId}`}
              onClick={() => setRows((rs) => toggleSlot(rs, r.slotId))}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                r.enabled
                  ? "bg-brand-600 text-brand-foreground"
                  : "bg-brand-50 text-ink/50"
              }`}
            >
              {r.enabled ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={saving}
        onClick={() => startSave(async () => setMsg(await saveParticipation(rows)))}
        className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {msg ? (
        <p role="status" data-testid="participation-message" className="mt-3 text-sm text-ink/70">
          {msg.message}
        </p>
      ) : null}
    </main>
  );
}
