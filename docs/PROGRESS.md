# HOKU build progress

Tracks the phased build from [`build-prompt.md`](build-prompt.md) (Phase 0–9)
and [`acquisition-module.md`](acquisition-module.md) (Phase A–D). A phase is
"done" only when its test gate is green.

| Phase | Scope | Status | Test gate |
|---|---|---|---|
| 0 | Bootstrap & automation harness | ✅ done | trivial unit test + Playwright apex load |
| 1 | Multi-tenant host routing | ✅ done | Host → route group; unknown → 404; cookie host-only |
| 2 | Auth + tenant isolation (RLS) | ✅ done | magic-link contract + **real RLS isolation via PGlite** |
| 3 | Block-based CMS | ⬜ | create/edit/reorder/publish; unpublished 404 |
| 4 | Theming UI (brand tokens) | ⬜ | re-skin via tokens; WCAG AA auto-correct |
| 5 | Custom domains (paid tier) | ⬜ | plan gate; add/verify (Vercel API mocked) |
| 6 | Directory (apex) | ⬜ | only published+listed; grouping/search |
| 7 | Billing (Stripe) | ⬜ | checkout upgrades plan; cancel reverts |
| 8 | HOKU Ads module | ⬜ | on-brand render; targeting; pacing; refund |
| 9 | Hardening | ⬜ | rate-limit; headers; cookie boundary; a11y |
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
