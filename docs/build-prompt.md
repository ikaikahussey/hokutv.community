# HOKU Platform — Claude Code Build Prompt

> Paste this entire document into Claude Code as the project brief. It is written
> as instructions to *you, Claude Code*. Build automation-first: prefer CLIs,
> generators, and managed-service features over hand-written code. Work in phases.
> **Each phase has a test gate. Do not advance to the next phase until that phase's
> tests pass without errors.** Run tests, read failures, fix, re-run, repeat.

---

## 1. Mission

Build **HOKU**, a multi-tenant website platform for local small-business owners.
Each tenant gets a website on a configurable subdomain, can upgrade to a custom
domain, edits content through a no-code block CMS, themes the site with their own
brand identity through a constrained UI, and can purchase auto-generated text+logo
ads that run across the HOKU network. A public directory indexes all published
tenant sites by category.

The clientele are **not technical and not designers.** Every decision favors
guardrails, managed services, and the fewest moving parts to maintain.

## 2. Locked stack — do not substitute

| Concern | Technology | Rationale |
|---|---|---|
| Framework | **Next.js (App Router), TypeScript** | Host-based middleware routing; official multi-tenant starter exists |
| Scaffold | **Vercel Platforms Starter Kit** | Pre-solves subdomain + custom-domain multi-tenancy; clone it, don't rebuild it |
| DB / Auth / Storage | **Supabase** (Postgres + Auth + Storage) | Magic-link auth, Row Level Security for tenant isolation, storage for media. A Supabase connector already exists in this environment |
| Hosting / Domains | **Vercel** | Domains API auto-issues SSL for custom domains; gates the paid tier |
| Payments | **Stripe** (plain, not Connect — see §9) | Checkout + subscriptions + webhooks |
| Styling | **Tailwind CSS + shadcn/ui** | CSS-variable design tokens map 1:1 onto per-tenant brand tokens |
| AI copy | **Anthropic API** | Ad-headline/CTA suggestions in admin |

Use **current stable** versions of all tooling. Check versions at install time
rather than pinning to possibly-stale numbers.

## 3. Domain architecture — load-bearing security boundary

Two registrable domains. This split is intentional and must not be collapsed.

```
hoku.com            → directory + marketing        (trusted zone)
app.hoku.com        → auth, admin, CMS, ad-buying   (trusted zone, session cookie lives here)
ads.hoku.com        → ad serving + click tracking   (isolated, high-volume, unauthenticated)
*.hokusites.com     → tenant subsites               (semi-untrusted, separate eTLD+1)
{custom domains}    → paid tenants                  (separate by nature)
```

**Hard rules:**
- The auth session cookie is scoped **host-only to `app.hoku.com`** — never
  domain-wide `.hoku.com`. Tenant content lives on a different registrable domain
  (`hokusites.com`) so the browser treats it as cross-site and the cookie boundary
  protects the control plane by default.
- Ad serving is a separate host with its own cookie scope; ad tracking cookies must
  never share a jar with auth cookies.
- For local development, emulate this with `*.localhost` subdomains and a second
  fake apex (e.g. `hokusites.localhost`); document the hosts/dnsmasq setup in the README.

## 4. Repo structure

A single Next.js app, routed by `Host` header in middleware, plus supporting dirs:

```
/app
  /(marketing)        → hoku.com apex + directory
  /(app)              → app.hoku.com admin, CMS, theming, ad-buying
  /(tenant)           → *.hokusites.com + custom domains, server-rendered tenant sites
  /api/serve          → ad serving endpoint (served via ads.hoku.com routing)
  /api/stripe         → webhooks
/lib                  → supabase clients, tokens, ad-render, auth helpers
/components           → shadcn/ui + shared
/supabase             → migrations, seed, config
/tests                → unit (vitest) + e2e (playwright)
/.github/workflows    → CI
middleware.ts         → host parsing + rewrite + cookie scoping
```

## 5. Global rules — apply in every phase

1. **Test-and-iterate is mandatory.** For each phase: write tests, run them, fix
   until green, then stop. Never report a phase complete with failing or skipped tests.
2. **RLS by default.** Every tenant-scoped table has Row Level Security enabled with
   policies scoping rows to the owning `tenant_id`. Serving/rollup paths use the
   service role explicitly and only where justified.
3. **Generate, don't hand-write, what tooling can produce** — types, migrations,
   shadcn components, webhook fixtures, CI config.
4. **Content is data, not code.** CMS pages are block JSON; themes are token JSON.
   Templates are authored against tokens — no hardcoded colors anywhere.
5. **Accessibility is enforced, not optional.** Brand colors pass WCAG AA contrast or
   are auto-corrected. This is tested.
6. Commit at the end of every green phase with a descriptive message.

## 6. Automation toolchain — use these, not manual steps

| Tool | Use it to |
|---|---|
| `npx create-next-app` / clone Platforms starter | Scaffold the whole multi-tenant skeleton |
| **Supabase CLI** | `supabase init`, `supabase start` (local Postgres+Auth in Docker), `supabase migration new`, `supabase db reset`, and **`supabase gen types typescript`** to auto-generate TS types from the schema after every migration |
| **Stripe CLI** | `stripe listen --forward-to` for local webhooks, `stripe trigger` and fixtures to test payment flows without manual clicking, `stripe products create`/fixtures for seeding plans |
| **Vercel CLI** | `vercel link`, `vercel env pull`, and the Domains API for custom-domain add/verify automation |
| **shadcn CLI** | `npx shadcn@latest add` for every UI primitive — do not hand-build components that shadcn provides |
| **Vitest** | Unit/integration tests |
| **Playwright** | E2E across the host-routing scenarios; install browsers via its CLI |
| **GitHub Actions** | Generate a CI workflow that runs typecheck + vitest + playwright on push |

Wire `supabase gen types` into a script so types regenerate whenever the schema
changes. Wire `stripe listen` into the dev task so webhooks work locally with no
manual setup.

---

## 7. Phased build

### Phase 0 — Bootstrap & automation harness
**Goal:** a running skeleton with the full test + automation loop working before any
feature code.
**Automate:** clone the Vercel Platforms starter; `supabase init` + `supabase start`;
install Vitest + Playwright + shadcn; generate the GitHub Actions CI; add npm scripts
that run the local Supabase stack, `stripe listen`, and `supabase gen types` on demand.
**Tests / gate:** a trivial unit test and a Playwright test that loads the apex page
both pass locally and in CI. Supabase local stack boots. Type generation runs clean.

### Phase 1 — Multi-tenant host routing
**Goal:** `middleware.ts` parses `Host`, distinguishes apex / `app` / `ads` /
`*.hokusites.com` / custom domain, and rewrites to the correct route group.
**Automate:** reuse the starter's middleware; extend for the two-apex model.
**Tests / gate:** Playwright tests assert that requests with different `Host` headers
land on the correct route group, including an unknown host → 404/landing. Cookie scope
is asserted host-only for `app`.

### Phase 2 — Auth + tenant isolation
**Goal:** Supabase magic-link sign-in at `app.hoku.com`; sessions scoped correctly;
RLS isolates tenant data.
**Automate:** Supabase Auth (magic link, no passwords); generate the `tenants` /
`users` / `sessions` schema via migration; `supabase gen types`.
**Tests / gate:** integration tests prove (a) a magic-link round trip authenticates,
(b) user A cannot read user B's tenant rows under RLS, (c) the `platform_admin` role
can. All green.

### Phase 3 — CMS (block-based pages)
**Goal:** owners create/edit/order pre-designed content blocks (hero, services, hours,
map, gallery, contact); pages persist as `body_json`; tenant route group server-renders
them.
**Automate:** shadcn for the editor UI; a block registry so blocks are declarative.
**Tests / gate:** create → edit → reorder → publish a page; rendered tenant HTML
reflects the block JSON; unpublished pages 404 publicly. E2E green.

### Phase 4 — Theming UI (brand tokens)
**Goal:** the constrained brand interface. Inputs: logo upload, one primary color
(optional accent), a font pairing from a curated list, a layout choice. Everything
else is derived.
**Automate:** generate the full tint/shade scale from the primary color; auto-extract a
suggested color from the uploaded logo; render tokens as per-tenant CSS custom
properties consumed by Tailwind/shadcn. Store as `tenants.theme` JSON.
**Tests / gate:** changing the primary color re-skins the whole rendered site via tokens
(no hardcoded colors found — assert this); **WCAG AA contrast is enforced or
auto-corrected** (tested with a deliberately pale input); live preview updates on input
change. Green.

### Phase 5 — Custom domains (paid tier)
**Goal:** paid tenants add a custom domain; SSL issues automatically; routing treats it
like a subsite.
**Automate:** Vercel Domains API for add + verification polling + auto-SSL; a plan flag
gates the API call; admin renders copy-paste DNS instructions.
**Tests / gate:** free plan cannot reach the custom-domain flow (assert the gate); the
add-domain flow records the hostname and reflects verification state. Mock the Vercel
API in tests; assert the calls.

### Phase 6 — Directory (apex)
**Goal:** `hoku.com` lists published, listed tenants grouped by category, with search and
pagination; doubles as cross-promotion.
**Automate:** query helpers + caching; invalidate on publish/category change.
**Tests / gate:** only `is_published AND is_listed` tenants appear; category grouping and
search return correct sets; unlisting removes a tenant. Green.

### Phase 7 — Billing
**Goal:** plan tiers (free subdomain / paid custom-domain) via Stripe; webhooks update
subscription state; tier read at domain-add and render time.
**Automate:** Stripe CLI fixtures to create products/prices; `stripe listen` for local
webhooks; `stripe trigger` to drive test events.
**Tests / gate:** a simulated checkout upgrades a tenant's plan via webhook; downgrade/
cancel reverts entitlements; the custom-domain gate from Phase 5 now flips with plan.
Driven by Stripe test events, green.

### Phase 8 — HOKU Ads module
**Goal:** the ad system, reusing brand tokens (creative), directory category/geo
(targeting), and Stripe (payment).
**Sub-parts, each tested:**
- **Creative generation:** inputs limited to headline / optional offer / CTA / URL; logo,
  colors, font pulled from the tenant `theme`; system composes 3–4 layout variants as
  token-driven renders (not baked images). Optional Anthropic-API copy suggestions.
- **Buying wizard** at `app.hoku.com`: Creative → Targeting (category + geo radius) →
  Schedule/Budget (flat prepaid packages, estimated reach, **no bidding**) → Review & Pay
  (Stripe Checkout) → Submit for approval → Campaign dashboard.
- **Serving endpoint** at `ads.hoku.com` (`/api/serve`): filter by targeting + remaining
  budget, apply frequency cap + budget pacing, select, log impression, return token
  config; clicks via tracking redirect.
- **Event pipeline:** write raw `ad_events`, roll up to hourly `ad_event_rollups`;
  dashboards read rollups, never raw.
- **Moderation gate:** automated link/content checks + a manual approval queue in the
  `platform_admin` role; auto-refund via Stripe API on rejection.
- **Host participation:** per-tenant opt-in/out per slot; default opt-in.
**Automate:** Stripe fixtures/triggers for ad purchases and refunds; seed script for
slots; token-render reuse from Phase 4.
**Tests / gate:** an ad renders on-brand from tokens; targeting filters correctly by
category + geo; budget draw-down pauses a campaign at exhaustion; rejection auto-refunds;
rollups match raw events; an unapproved campaign never serves. All green.

### Phase 9 — Hardening
**Goal:** production-readiness.
**Automate:** rate-limit the serving endpoint; cache tenant HTML and directory; security
headers; confirm cookie scoping end-to-end; a11y pass.
**Tests / gate:** rate-limit test trips; security-header test passes; the
`app`-cookie-not-readable-from-`hokusites` boundary is asserted in an E2E test; Lighthouse/
axe accessibility check passes a set threshold.

---

## 8. Data model (Supabase / Postgres)

Generate via migrations; enable RLS on every tenant-scoped table.

```sql
tenants(id, subdomain, custom_domain, plan, category,
        is_published, is_listed, theme jsonb, status, created_at)
users(id, tenant_id, email, role)            -- owner | staff | platform_admin
pages(id, tenant_id, slug, title, body_json jsonb, status, updated_at)
media(id, tenant_id, storage_path, kind)
domains(id, tenant_id, hostname, vercel_domain_id, ssl_status)
subscriptions(id, tenant_id, stripe_customer, plan, current_period_end)

ad_creatives(id, tenant_id, headline, subtext, cta_label, destination_url,
             layout_variant, brand_snapshot_json jsonb, status, created_at)
ad_campaigns(id, tenant_id, creative_id, package, targeting_json jsonb,
             budget_cents, spend_cents, start_date, end_date, status,
             stripe_payment_id)
ad_slots(id, slot_type, dimensions)               -- config
ad_participation(tenant_id, slot_type, enabled)   -- host opt-in
ad_events(id, campaign_id, host_tenant_id, slot, type, context_json jsonb, created_at)
ad_event_rollups(campaign_id, host_tenant_id, hour, impressions, clicks)
```

RLS scopes creatives/campaigns to the owning `tenant_id`; serving and rollups run with
service-role access only where required.

## 9. Payments scope

Build **plain Stripe** (tenant pays HOKU; HOKU keeps ad revenue). Do **not** build
Stripe Connect / revenue share now. Structure the ad-payment code so a Connect payout
path could be added later without rework, but leave it unbuilt.

## 10. Secrets / env (document in `.env.example`, never commit real values)

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID
ANTHROPIC_API_KEY
APP_BASE_DOMAIN=hoku.com
TENANT_BASE_DOMAIN=hokusites.com
ADS_HOST=ads.hoku.com
```

## 11. Definition of done

- All phases complete with green tests and passing CI.
- A seed script creates: a demo tenant on a subdomain, a themed published site, a
  directory entry, and one live ad serving on a second demo tenant's site.
- README documents local setup (including the multi-host emulation), the automation
  scripts, and how to run each test suite.
- No hardcoded colors; cookie scoping verified; RLS verified by test.

> Begin at Phase 0. Announce the start of each phase, run its tests, iterate until they
> pass, commit, then proceed. Report the test result at each gate.
