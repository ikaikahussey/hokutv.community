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
| 8 | HOKU Ads module | ✅ core | render/targeting/pacing/rollups/refund + serving (buying-wizard UI deferred) |
| 9 | Hardening | ✅ done | rate-limit trips; security headers; cookie boundary; axe a11y |
| A–D | Acquisition funnel (minimal) | ⬜ | pipeline w/ mocks; compliance flagged → `COUNSEL.md` |

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
- **Deferred:** the multi-step buying-wizard UI (Creative→Targeting→Budget→
  Pay→dashboard) and the manual moderation queue screen. All their underlying
  behaviors are implemented + tested; only the admin UI surface remains.
