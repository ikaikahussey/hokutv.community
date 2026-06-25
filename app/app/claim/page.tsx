"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Channel } from "@/lib/acq/verify";
import {
  startClaim,
  finishClaim,
  type StartClaimResult,
  type FinishClaimResult,
} from "./actions";

export default function ClaimPage() {
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [code, setCode] = useState("");
  const [started, setStarted] = useState<StartClaimResult | null>(null);
  const [done, setDone] = useState<FinishClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  // Success screen.
  if (done?.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 text-center">
        <span className="mx-auto rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          Claimed
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink">
          Your site is live 🎉
        </h1>
        <p role="status" data-testid="claim-success" className="text-sm text-ink/70">
          {done.message}
        </p>
        <Link
          href="/editor"
          className="mx-auto rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-700"
        >
          Customize your site
        </Link>
      </main>
    );
  }

  const verifying = started?.ok;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">
          Claim your site
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          We built a preview for{" "}
          {started?.businessName ? (
            <strong>{started.businessName}</strong>
          ) : (
            "your business"
          )}
          . Enter the code from your postcard and verify ownership to take
          control — it&apos;s an offer, not a bill.
        </p>
      </div>

      {!verifying ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink/70">Claim code</span>
            <input
              data-testid="claim-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="from your postcard"
              className="rounded-md border border-brand-200 px-3 py-2"
            />
          </label>
          <button
            type="button"
            data-testid="claim-start"
            disabled={busy || !token.trim()}
            onClick={() =>
              startBusy(async () => {
                setError(null);
                try {
                  const res = await startClaim(token);
                  if (res.ok) setStarted(res);
                  else setError(res.message);
                } catch {
                  setError("Something went wrong. Please try again.");
                }
              })
            }
            className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {started?.demoCode && (
            <p data-testid="demo-code" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Demo mode — your verification code is{" "}
              <strong>{started.demoCode}</strong>.
            </p>
          )}
          <fieldset className="flex gap-2 text-sm">
            <legend className="mb-1 text-ink/70">Verify via</legend>
            {(["email", "phone"] as Channel[]).map((c) => (
              <label key={c} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="channel"
                  checked={channel === c}
                  onChange={() => setChannel(c)}
                />
                {c}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink/70">6-digit code</span>
            <input
              data-testid="claim-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-brand-200 px-3 py-2 font-mono"
            />
          </label>
          <button
            type="button"
            data-testid="claim-finish"
            disabled={busy || !code.trim()}
            onClick={() =>
              startBusy(async () => {
                setError(null);
                try {
                  const res = await finishClaim({ token, channel, code });
                  if (res.ok) setDone(res);
                  else setError(res.message);
                } catch {
                  setError("Something went wrong. Please try again.");
                }
              })
            }
            className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & claim"}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" data-testid="claim-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </main>
  );
}
