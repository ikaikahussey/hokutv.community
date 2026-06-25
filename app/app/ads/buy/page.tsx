"use client";

import { type CSSProperties, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { emptyDraft, validateDraft, type AdDraft } from "@/lib/ads/draft";
import { generateVariants, renderAd } from "@/lib/ads/creative";
import { AD_PACKAGES, estimateReach, findPackage } from "@/lib/ads/packages";
import { draftTargeting } from "@/lib/ads/draft";
import { buildThemeVars, DEFAULT_THEME_INPUT } from "@/lib/theme/tokens";
import type { CopySuggestion } from "@/lib/ads/copy";
import { suggestAdCopy, submitCampaign, type SubmitResult } from "../actions";

const STEPS = ["Creative", "Targeting", "Budget", "Review & Pay"] as const;
const CATEGORIES = ["coffee", "dining", "retail", "services", "fitness", "beauty"];

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function BuyAdPage() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AdDraft>(emptyDraft());
  const [suggestions, setSuggestions] = useState<CopySuggestion | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [result, setResult] = useState<SubmitResult | null>(null);

  const set = (patch: Partial<AdDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const brand = useMemo(() => buildThemeVars(DEFAULT_THEME_INPUT), []);
  const pkg = findPackage(draft.packageId) ?? AD_PACKAGES[0];
  const reach = estimateReach(pkg, draftTargeting(draft));

  const preview = useMemo(() => {
    const [variant] = generateVariants(
      {
        headline: draft.headline || "Your headline",
        offer: draft.offer,
        cta: draft.cta || "Learn more",
        url: draft.url || "#",
      },
      brand
    );
    return renderAd(variant);
  }, [draft.headline, draft.offer, draft.cta, draft.url, brand]);

  const stepValid = useMemo(() => {
    if (step === 0) return draft.headline.trim() !== "" && draft.cta.trim() !== "";
    if (step === 2) return Boolean(findPackage(draft.packageId));
    return true;
  }, [step, draft]);

  const validation = validateDraft(draft);

  if (result?.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 text-center">
        <span className="mx-auto rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          Submitted
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink">
          Your ad is in review
        </h1>
        <p role="status" data-testid="submit-message" className="text-sm text-ink/70">
          {result.message}
        </p>
        <p className="text-xs text-ink/50" data-testid="campaign-id">
          Campaign {result.campaignId} · {result.status}
        </p>
        <Link
          href="/ads"
          className="mx-auto rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-700"
        >
          Go to campaign dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-2">
      <section aria-label="ad wizard" className="flex flex-col gap-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Buy an ad</h1>
          <ol className="mt-2 flex flex-wrap gap-2 text-xs">
            {STEPS.map((label, i) => (
              <li
                key={label}
                data-testid={i === step ? "wizard-step" : undefined}
                className={`rounded-full px-3 py-1 font-medium ${
                  i === step
                    ? "bg-brand-600 text-brand-foreground"
                    : i < step
                      ? "bg-brand-100 text-brand-700"
                      : "bg-brand-50 text-ink/50"
                }`}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>
        </div>

        {/* Step 1 — Creative */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Headline</span>
              <input
                data-testid="f-headline"
                value={draft.headline}
                onChange={(e) => set({ headline: e.target.value })}
                className="rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Offer (optional)</span>
              <input
                data-testid="f-offer"
                value={draft.offer ?? ""}
                onChange={(e) => set({ offer: e.target.value })}
                className="rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Call to action</span>
              <input
                data-testid="f-cta"
                value={draft.cta}
                onChange={(e) => set({ cta: e.target.value })}
                className="rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Destination URL (https)</span>
              <input
                data-testid="f-url"
                value={draft.url}
                placeholder="https://"
                onChange={(e) => set({ url: e.target.value })}
                className="rounded-md border border-brand-200 px-3 py-2"
              />
            </label>

            <button
              type="button"
              data-testid="suggest-copy"
              disabled={suggesting}
              onClick={() =>
                startSuggest(async () => {
                  const s = await suggestAdCopy({
                    businessName: draft.headline || "your business",
                    category: draft.category,
                    offer: draft.offer,
                  });
                  setSuggestions(s);
                })
              }
              className="self-start rounded-md border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
            >
              {suggesting ? "Thinking…" : "✨ Suggest copy"}
            </button>
            {suggestions && (
              <div data-testid="suggestions" className="flex flex-col gap-2 rounded-md bg-brand-50 p-3">
                <p className="text-xs font-medium text-ink/60">Tap to use a headline</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.headlines.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => set({ headline: h })}
                      className="rounded-full border border-brand-200 bg-surface px-3 py-1 text-xs text-brand-700 hover:bg-brand-100"
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.ctas.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ cta: c })}
                      className="rounded-full border border-brand-200 bg-surface px-3 py-1 text-xs text-brand-700 hover:bg-brand-100"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Targeting */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Category</span>
              <select
                data-testid="f-category"
                value={draft.category ?? ""}
                onChange={(e) => set({ category: e.target.value || undefined })}
                className="rounded-md border border-brand-200 px-3 py-2"
              >
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70">Geo radius (km, optional)</span>
              <input
                data-testid="f-radius"
                type="number"
                min={0}
                value={draft.geo?.radiusKm ?? ""}
                onChange={(e) => {
                  const km = Number(e.target.value);
                  set({
                    geo: km > 0 ? { lat: 21.3069, lng: -157.8583, radiusKm: km } : undefined,
                  });
                }}
                className="rounded-md border border-brand-200 px-3 py-2"
              />
              <span className="text-xs text-ink/50">
                Centered on your business location (Honolulu in this demo).
              </span>
            </label>
            <p data-testid="reach" className="text-sm text-ink/70">
              Estimated reach with the {pkg.label} package:{" "}
              <strong>{reach.toLocaleString()}</strong> people
            </p>
          </div>
        )}

        {/* Step 3 — Budget */}
        {step === 2 && (
          <div className="flex flex-col gap-3" data-testid="packages">
            {AD_PACKAGES.map((p) => {
              const r = estimateReach(p, draftTargeting(draft));
              const selected = draft.packageId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`pkg-${p.id}`}
                  onClick={() => set({ packageId: p.id })}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                    selected
                      ? "border-brand-600 bg-brand-50"
                      : "border-brand-200 hover:bg-brand-50"
                  }`}
                >
                  <span>
                    <span className="block font-heading font-semibold text-ink">
                      {p.label}
                    </span>
                    <span className="block text-xs text-ink/60">
                      {p.impressions.toLocaleString()} impressions · ~
                      {r.toLocaleString()} people
                    </span>
                  </span>
                  <span className="font-heading text-lg font-bold text-brand-700">
                    {dollars(p.priceCents)}
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-ink/50">
              Flat prepaid packages — no bidding. You&apos;re charged once at checkout.
            </p>
          </div>
        )}

        {/* Step 4 — Review & Pay */}
        {step === 3 && (
          <div className="flex flex-col gap-3" data-testid="review">
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink/60">Headline</dt>
              <dd className="text-ink">{draft.headline}</dd>
              <dt className="text-ink/60">CTA</dt>
              <dd className="text-ink">{draft.cta}</dd>
              <dt className="text-ink/60">Targeting</dt>
              <dd className="text-ink">
                {draft.category ?? "any category"}
                {draft.geo ? ` · ${draft.geo.radiusKm}km` : ""}
              </dd>
              <dt className="text-ink/60">Package</dt>
              <dd className="text-ink">
                {pkg.label} — {dollars(pkg.priceCents)} · ~{reach.toLocaleString()} people
              </dd>
            </dl>
            {!validation.ok && (
              <ul data-testid="review-errors" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {validation.errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              data-testid="pay-submit"
              disabled={!validation.ok || submitting}
              onClick={() =>
                startSubmit(async () => {
                  const res = await submitCampaign(draft);
                  setResult(res);
                  if (res.checkoutUrl) window.location.assign(res.checkoutUrl);
                })
              }
              className="self-start rounded-md bg-brand-600 px-5 py-2.5 font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : `Pay ${dollars(pkg.priceCents)} & submit for review`}
            </button>
            {result && !result.ok && (
              <p role="alert" className="text-sm text-red-600">
                {result.message}
              </p>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            data-testid="back"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-md border border-brand-200 px-4 py-2 text-sm text-brand-700 disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              data-testid="next"
              disabled={!stepValid}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </section>

      {/* Live on-brand preview — reuses the exact serving renderer */}
      <section
        aria-label="ad preview"
        data-testid="ad-preview"
        style={brand as CSSProperties}
        className="h-fit overflow-hidden rounded-lg border border-brand-100 p-6"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink/40">
          Live preview
        </p>
        {preview}
      </section>
    </main>
  );
}
