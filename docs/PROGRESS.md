# HOKU build progress

Tracks the phased build from [`build-prompt.md`](build-prompt.md) (Phase 0–9)
and [`acquisition-module.md`](acquisition-module.md) (Phase A–D). A phase is
"done" only when its test gate is green.

| Phase | Scope | Status | Test gate |
|---|---|---|---|
| 0 | Bootstrap & automation harness | ✅ done | trivial unit test + Playwright apex load |
| 1 | Multi-tenant host routing | ✅ done | Host → route group; unknown → 404; cookie host-only |
| 2 | Auth + tenant isolation (RLS) | ✅ done | magic-link contract + **real RLS isolation via PGlite** |
| 3 | Block-based CMS | ✅ done | create/edit/reorder/publish (UI E2E); unpublished 404 (RLS) |
| 4 | Theming UI (brand tokens) | ✅ done | re-skin via tokens (E2E); WCAG AA enforced/auto-corrected |
| 5 | Custom domains (paid tier) | ✅ done | plan gate; add/verify (Vercel mocked); domains RLS |
| 6 | Directory (apex) | ✅ done | only published+listed; grouping/search/paginate; unlist removes |
| 7 | Billing (Stripe) | ✅ done | checkout upgrades plan; cancel reverts; gate flips with plan |
| 8 | HOKU Ads module | ✅ done | render/targeting/pacing/rollups/refund + serving + **buying wizard, moderation queue, host participation (E2E)** |
| 9 | Hardening | ✅ done | rate-limit trips; security headers; cookie boundary; axe a11y |
| A–D | Acquisition funnel | ✅ done | pipeline w/ mocks; suppression+privacy+verification guardrails; **claim/verify wizard (E2E)**; compliance → COUNSEL.md |

**Definition of done (§11) met:** all phases green + CI; `supabase/seed.sql`
creates a themed published tenant with a directory entry **and one live ad
serving on a second demo tenant's site** (validated against the real schema in
`tests/unit/seed.test.ts`); README documents setup/scripts/tests; no hardcoded
colors; cookie scoping + RLS verified by test.

## Environment constraints in this sandbox

- **No Docker daemon** → the live Supabase stack (`supabase start`) cannot boot
  here. Instead, RLS and SQL migrations are tested against **PGlite** — real
  Postgres compiled to WASM, in-process, no Docker. The test harness
  (`tests/helpers/pg.ts`) installs a Supabase-compatible `auth` shim
  (`auth.uid()`, the anon/authenticated/service_role roles) and applies the
  actual `supabase/migrations/*.sql`, so policies are exercised exactly as
  Postgres enforces them.
- Supabase/Stripe/Vercel CLIs are not installed in the sandbox; their flows are
  mocked in tests and documented for real local/CI environments.
- Playwright runs against the pre-installed Chromium (build matching 1.56.1).

## Phase 0 notes

- Next.js 15 (App Router) + TS, Tailwind 3 with CSS-variable brand tokens (no
  hardcoded component colors), Vitest + Playwright, GitHub Actions CI.
- `tests/unit/slug.test.ts` — unit gate. `tests/e2e/apex.spec.ts` — apex load.

## Phase 1 notes

- `lib/domains/resolve-host.ts` — pure, unit-tested host → zone resolver
  (apex / app / ads / tenant / unknown). `middleware.ts` rewrites by host.
- **Route groups can't be rewrite targets** (they aren't URL segments), so the
  rewrite targets are real internal segments: `/app`, `/ads`, `/s/[subdomain]`.
  The marketing route group serves the apex `/`. Internal segments are 404'd on
  the public apex so they don't leak into the indexable surface.
- Host is read from `x-forwarded-host` (proxy/Vercel) then `host`; tests emulate
  hosts via that header — no DNS needed. Bare `localhost` → apex for dev.
- Cookie boundary: `lib/auth/cookie.ts` issues **host-only** auth cookies (no
  `Domain`). Unit-tested now; re-asserted end-to-end in Phase 9.
- **Custom domains** (paid tenants) resolve via DB lookup in Phase 5; until then
  non-matching hosts are `unknown` → 404.

## Phase 2 notes

- `supabase/migrations/0001_init.sql` — `tenants` + `users` with RLS. Helper
  functions `current_tenant_id()` / `is_platform_admin()` are `SECURITY DEFINER`
  so the user-table policies don't recurse. `service_role` bypasses RLS for
  serving/provisioning paths.
- `tests/unit/rls.test.ts` (PGlite) proves: owner A sees only tenant A, owner B
  only B, A can't read/update B's rows, non-admins can't insert tenants,
  platform_admin sees all, anon sees none. **This is the real isolation gate.**
- Magic-link flow: `lib/auth/magic-link.ts` (pure, unit-tested) + Supabase
  clients (`lib/supabase/{server,client,service}.ts`) + `/login` action +
  `/auth/callback` route. Callback + cookie are host-only on `app.hoku.com`.
- The live magic-link round trip needs hosted Supabase Auth; its logic is a
  contract test here. `sessions` are managed by Supabase `auth.*`, not a custom
  table.

## Phase 3 notes

- Content is data: `lib/cms/types.ts` (typed block union), `lib/cms/blocks.tsx`
  (declarative registry + token-only renderer), `lib/cms/page-ops.ts` (pure
  create/edit/reorder/publish). Editor at `/editor` is a thin client over those,
  with a live preview that reuses the exact tenant renderer.
- `supabase/migrations/0002_pages.sql` — `pages` + RLS. Anon may read only a
  **published** page on a **published** tenant (`tenant_is_published()` is
  SECURITY DEFINER so the anon policy doesn't depend on tenants-RLS). Members
  CRUD their own tenant's pages.
- Tenant route renders blocks via `getPublishedHomePage(subdomain)`: real DB
  query when Supabase is configured (RLS hides unpublished → 404), generated
  **demo** content otherwise so the sandbox renders end-to-end.
- Gates: `page-ops` + `cms-render` units (ops + HTML-reflects-JSON + no hardcoded
  hex), `rls-pages` (unpublished invisible to anon, tenant CRUD isolation),
  `editor` E2E (full UI flow), `tenant` E2E (server-rendered blocks).

## Phase 4 notes

- Pure theming math in `lib/theme/`: `color` (sRGB + WCAG luminance/contrast),
  `scale` (50–950 from one primary), `contrast` (AA foreground — always
  achievable at 4.5; auto-corrects by darkening when a brand insists on white
  text), `tokens` (curated fonts/layouts → CSS-var map), `logo`
  (suggest color from canvas pixels).
- Owner sets ≤1 primary + optional accent + font + layout; everything else is
  derived. Tokens are applied per-tenant as CSS custom properties scoped on the
  tenant subtree, so a color change re-skins every block with no rebuild.
- `/theme` editor has a token-driven live preview. E2E reads computed colors in
  the browser: changing the primary re-skins the CTA AND the CTA still passes
  WCAG AA. Unit tests cover scale direction, AA enforcement + auto-correction,
  and logo color suggestion.

## Phase 5 notes

- `lib/integrations/vercel.ts` — injectable Vercel Domains client (real fetch
  impl; mocked in tests). `lib/domains/custom-domain.ts` — plan gate, hostname
  normalization/validation, add + verify flow, DNS instructions; all deps
  injected → unit-tested end to end without Vercel.
- `0003_domains.sql` — `domains` table + RLS (tenant-scoped). A domain is only
  promoted to `tenants.custom_domain` (and routed) once SSL is active.
- Routing: `resolveHost` now classifies an external FQDN as `custom` and
  rewrites to `/s/<host>`; `getPublishedSite` resolves by `custom_domain` for
  dotted hosts (a demo dot-guard keeps spoofed unknown hosts → 404).
- Admin `/domains` form is plan-gated via the same logic. Gate proven by units:
  free plan never reaches Vercel; paid records hostname + pending verification;
  activation mirrors to routing. `rls-domains` proves tenant isolation.

## Phase 8 notes (ads)

- Pure, fully-tested ad logic in `lib/ads/`: `targeting` (category + geo radius
  via haversine), `pacing` (servable = approved/active + budget; selection with
  frequency cap; `chargeImpression` pauses at exhaustion), `rollups` (raw events
  → hourly, totals match), `moderation` (https + prohibited-content checks →
  auto-refund of unspent budget), `creative` (token-driven variants; on-brand
  render with no hardcoded color).
- `0006_ads.sql`: creatives/campaigns/slots/participation/events/rollups + RLS.
  Creatives/campaigns are tenant-scoped; raw `ad_events`/rollups are
  service-role only (dashboards read rollups, never raw).
- Serving endpoint `ads.hoku.com/api/serve` (→ `/ads/api/serve`): selects an
  eligible ad, logs an impression, returns the on-brand creative token config
  (demo campaign in the sandbox). **Unapproved campaigns never serve.**
- **Admin surfaces (built):**
  - Buying wizard at `app.hoku.com/ads/buy` — Creative → Targeting → Budget →
    Review & Pay → submit-for-approval, with an on-brand live preview (reuses
    the serving renderer), Anthropic copy suggestions (`lib/ads/copy.ts`,
    injectable + local fallback), and flat prepaid packages with estimated reach
    (`lib/ads/packages.ts`). `submitCampaign` creates the creative+campaign as
    `pending` (RLS-scoped); it never self-approves.
  - Campaign dashboard at `/ads`; moderation queue at `/moderation`
    (platform_admin) with auto-flags + approve/reject and Stripe auto-refund on
    reject (`lib/ads/review.ts`, `refundPayment`); host participation at
    `/participation` (per-slot opt-in, default opt-in, `lib/ads/participation.ts`).
  - Pure logic for all of the above is unit-tested in `tests/unit/ads-buy.test.ts`;
    the wizard and queue are E2E-tested (`tests/e2e/ads-buy.spec.ts`,
    `tests/e2e/moderation.spec.ts`).
- **Server Actions note:** the control plane is reached via a host rewrite, so a
  Server Action POST carries `x-forwarded-host: app.<base>`. Next's CSRF check
  needs that host allow-listed (`experimental.serverActions.allowedOrigins` in
  `next.config.ts`) or it rejects the action.

## Phase A–D notes (acquisition — minimal, compliance flagged for counsel)

> **Not cleared for live sending.** Built minimal per direction; legal posture
> (trademark, direct-mail law, data licensing) needs counsel sign-off —
> `COUNSEL.md`. Guardrails are clearly-marked stubs, not fail-closed invariants.

- `0007_acquisition.sql`: `acq_prospects` / `acq_suppression` / `acq_claims`
  (internal; service-role writes, platform_admin reads). Applied + validated by
  the PGlite harness alongside the other migrations.
- `lib/acq/engine.ts` — the uploaded pipeline refactored to **dependency
  injection** (Places / Lob mail / screenshot / repo all injected), so
  discover→provision→screenshot→postcard is unit-tested with mocks (Phase A
  gate): eligible business → provisional site + screenshot + queued postcard;
  suppressed/seen/no-address skipped **before** any generation or send.
- Minimal guardrails, surfaced + tested: provisional tenants are
  unpublished/unlisted/`provisional` (`PROVISIONAL_TENANT_FLAGS`); the postcard
  reads as an offer not a bill (`postcardComplianceIssues` finds no missing
  disclosure / no bill-like language); discovery requires a mailable address.
- `lib/acq/claim.ts` (Phase B/C) — claim requires the token AND a verified
  second factor before transfer; token is single-use; founder credit + publish-
  on-claim flow through `activateTenant`/`recordClaim`. Tested.
- **Claim wizard (built):** customer-facing flow at `app.hoku.com/claim` —
  postcard token → second-factor OTP (`lib/acq/verify.ts`) → claim. Wired to
  `claimSite()`, so the token + verified-factor requirement is enforced through
  the UI; on success the provisional site publishes and a founder credit is
  applied. E2E: `tests/e2e/claim.spec.ts`. Claiming is the **inbound** half, so
  it's functional; **outbound** OTP/postcard *delivery* stays counsel-gated
  (COUNSEL.md) — demo mode reveals the code so the flow is testable offline.
- **Still deferred (needs live keys, not code):** real Places/Lob/Playwright
  integrations and live OTP delivery — all behind clearly-marked stubs.
