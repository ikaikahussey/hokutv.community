# HOKU Acquisition Module — Build Prompt Addendum

> Append to the HOKU Claude Code build prompt. Adds an outbound acquisition funnel
> that builds provisional sites for local businesses and invites owners to claim
> and pay. Same rules apply: automation-first, **test gate per phase, do not advance
> until tests pass.** Compliance items in §5 are non-negotiable build requirements.

The pipeline script `acquisition-engine.ts` implements discovery → provisional site
→ screenshot → postcard. This addendum covers the claim flow, payment, pricing,
data model, ads integration, and the compliance gates Claude Code must enforce.

---

## 1. Pricing — implement as configurable constants, not hardcoded

Funnel reality: cold direct mail converts at ~1–3%; each postcard costs ~$0.50–$1.00
all-in; acquisition cost per claimed site ≈ $50–$100 before human time. Therefore:

```ts
// /lib/acq/pricing.ts — tune these to real cost/payback; do not invent fixed prices
export const ACQ_PRICING = {
  claimPrice: 0,                  // claiming the subdomain site is FREE (max conversion)
  founderAdCreditCents: 5000,     // applied if payment entered at claim (drives ads flow)
  founderWindowDays: 14,          // intro offer expiry from postcard mail date
  // recurring monetization reuses existing tiers:
  customDomainPlan: "paid",       // gated as in the custom-domain phase
  // ad packages come from the HOKU Ads module (flat prepaid, no bidding)
};
```

Rule: claim is free; the founder ad credit is the lever that converts a claim into a
paid ad purchase. Final dollar figures depend on the operator's per-postcard cost and
target payback — leave them as constants with comments, not literals in business logic.

## 2. Claim + payment UI

Entry: postcard QR / `hoku.com/claim/{token}`.

**Step 1 — Preview & hook.** Landing shows the live preview (and the screenshot from
the postcard) of the business's own pre-built site. Headline: "This is your site.
Claim it free." The provisional banner is visible.

**Step 2 — Ownership verification (mandatory, anti-abuse).** The claim token proves
postcard possession at the business address; require a second factor before transfer:
magic link to the Places-listed business email **or** phone OTP. No verification → no
transfer. This prevents claiming a competitor's site.

**Step 3 — Transfer & onboard.** On verify: create the owner `user`, attach to the
provisional `tenant`, flip `status` provisional → active, set up passwordless auth.
Drop the owner into the block CMS + theming UI to correct content (hours, etc.).

**Step 4 — Activate (the payment + ads moment).** Present the founder offer: enter
payment via **Stripe Checkout** to apply the ad credit and launch a starter campaign,
and/or upgrade to a custom domain. This is the integration seam with the ads module —
claiming lands the tenant in the ad-buying wizard with the credit pre-applied.

**Step 5 — Publish.** Only now does the site become `is_published` + `is_listed` and
lose `noindex`. Nothing is public before a verified claim.

UI built with shadcn/ui; live preview reuses the theming token renderer.

## 3. Data model additions (Supabase; RLS where tenant-scoped)

```sql
acq_prospects(id, place_id, tenant_id, business_name, mail_address jsonb,
              claim_token, postcard_id, status, created_at)
              -- status: site_generated | postcard_sent | claimed | rejected

acq_suppression(id, place_id, zip, email, reason, created_at)
              -- opt-outs + do-not-contact; checked before every send

acq_claims(id, prospect_id, tenant_id, verified_via, verified_at, paid bool,
           stripe_payment_id, founder_credit_applied_cents)
```

`claim_token` is single-use; invalidate on successful claim. Provisional tenants are
excluded from all public/directory queries by the `status='provisional'` filter.

## 4. Integration with the HOKU Ads flow

- The screenshot is reused twice (postcard + claim landing) — one render, two uses.
- Provisional brand tokens are the same tokens the ad module renders against, so a
  claimed tenant enters the ad-buying wizard with brand auto-loaded and the founder
  credit applied as account balance against a flat ad package.
- A claimed acquisition is just a tenant: it uses the existing ad creatives, serving,
  moderation, and Stripe paths with no parallel system.

## 5. Compliance gates — Claude Code MUST enforce and test

1. **Provisional = private.** Assert in tests: provisional tenants are `noindex`,
   absent from the directory, served only on the provisional host, never on a live
   tenant subdomain, and never `is_published` until a verified claim.
2. **Postcard is not a bill.** The template must include sender identity + physical
   address, an explicit "this is not a bill / you owe nothing" statement, and an
   opt-out path. Test the rendered template contains these; test it contains no
   amount-due / invoice language.
3. **Suppression honored.** Test that a suppressed `place_id`/`zip`/`email` is skipped
   before any site generation or mail send, and that an opt-out submission writes to
   `acq_suppression` and prevents re-mailing.
4. **Licensed data only.** Discovery uses the Places API; no Maps HTML scraping. Use
   only Places-verified fields in generated content — no AI-invented facts (hours,
   claims). Test the generator rejects a business with no mailable address.
5. **Ownership verification before transfer.** Test that transfer fails without the
   second factor, and that a used `claim_token` cannot be replayed.
6. **Trademark posture.** Do not publish the business's marks publicly pre-claim;
   provisional preview only. (Flag for the operator's counsel — not auto-resolvable.)

## 6. Phases & test gates

**Phase A — Pipeline.** Wire `acquisition-engine.ts`; mock Places/Lob/Playwright in
tests. Gate: a batch run produces provisional tenants + screenshots + queued postcards;
suppressed/seen businesses are skipped; no-address businesses skipped.

**Phase B — Claim & verify.** Build the claim route + ownership verification + transfer.
Gate: unverified claim cannot transfer; verified claim flips status and creates the
owner; token is single-use.

**Phase C — Payment & publish.** Stripe Checkout at claim, founder credit applied,
publish-on-claim. Gate: simulated payment applies the credit and launches a starter ad;
site becomes public only after a verified, paid (or free-claimed) flow; rejected/opted-
out prospects never publish.

**Phase D — Ads handoff.** Gate: a claimed tenant enters the ad wizard with brand tokens
loaded and credit as balance, and can run one ad end-to-end via the existing ads paths.

> Begin at Phase A. Mock all external services in tests. Run, fix, re-run until green;
> commit per green phase; report the test result at each gate.
