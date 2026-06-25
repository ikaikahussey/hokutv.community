# HOKU

A multi-tenant website platform for local small-business owners. Each tenant
gets a site on a subdomain (upgradeable to a custom domain), a no-code block
CMS, constrained brand theming, and auto-generated ads that run across the HOKU
network. A public directory indexes published tenant sites by category.

Built **automation-first** on a locked stack — see
[`docs/build-prompt.md`](docs/build-prompt.md) for the full brief and
[`docs/acquisition-module.md`](docs/acquisition-module.md) for the outbound
acquisition funnel.

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage), RLS for tenant isolation |
| Hosting / Domains | Vercel (Domains API for custom-domain SSL) |
| Payments | Stripe (plain — not Connect) |
| Styling | Tailwind CSS + CSS-variable design tokens (per-tenant brand) |
| AI copy | Anthropic API (ad-headline/CTA suggestions) |
| Tests | Vitest (unit/integration) + Playwright (E2E) |

## Domain architecture (load-bearing security boundary)

Two registrable domains — this split is intentional and must not be collapsed:

```
hoku.com            → directory + marketing        (trusted zone)
app.hoku.com        → auth, admin, CMS, ad-buying   (trusted zone; session cookie lives here)
ads.hoku.com        → ad serving + click tracking   (isolated, unauthenticated)
*.hokusites.com     → tenant subsites               (semi-untrusted, separate eTLD+1)
{custom domains}    → paid tenants
```

The auth session cookie is scoped **host-only to `app.hoku.com`**, never
domain-wide `.hoku.com`. Tenant content lives on a different registrable domain
(`hokusites.com`) so the browser treats it as cross-site and the cookie boundary
protects the control plane by default.

## Local setup

### Prerequisites

- Node.js ≥ 20 (this repo is developed on Node 22)
- [Supabase CLI](https://supabase.com/docs/guides/cli) + **Docker** (for the
  local Postgres/Auth/Storage stack)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) (for webhook forwarding)
- [Vercel CLI](https://vercel.com/docs/cli) (for custom-domain automation)

> **Sandbox note:** the CI/dev sandbox this was built in has no Docker daemon, so
> the live Supabase stack can't boot there. Tests are written to run against
> **in-memory fakes** and mocked external services — `npm test` needs no Docker,
> no network, and no secrets. The Supabase/Stripe/Vercel CLIs are only needed
> for live local development.

### Install & run

```bash
npm install
cp .env.example .env        # fill in values for live dev (tests don't need them)
npm run dev                 # http://localhost:3000
```

### Multi-host emulation

The two-apex model (§ Domain architecture) is emulated locally with
`*.localhost` subdomains plus a second fake apex. Add to `/etc/hosts` (or use
dnsmasq for wildcards):

```
127.0.0.1  hoku.localhost app.hoku.localhost ads.hoku.localhost
127.0.0.1  acme.hokusites.localhost demo.hokusites.localhost
```

Then visit e.g. `http://app.hoku.localhost:3000` (admin) or
`http://demo.hokusites.localhost:3000` (a tenant subsite). The E2E suite
emulates hosts by sending an explicit `Host` header rather than relying on DNS.

### Supabase (live dev)

```bash
npm run db:start            # supabase start (needs Docker)
npm run db:reset            # apply migrations + seed
npm run gen:types           # regenerate lib/supabase/database.types.ts from schema
```

Run `npm run gen:types` after every migration so TypeScript types track the
schema.

`supabase/seed.sql` creates the Definition-of-Done demo data: two themed,
published tenants on subdomains (`kalihi-coffee`, `north-shore-surf`) with
directory entries, and **one live ad** — `kalihi-coffee`'s approved campaign
serving in `north-shore-surf`'s opted-in sidebar slot. The seed is idempotent
and validated against the real schema in `tests/unit/seed.test.ts`.

### Key routes (control plane, `app.hoku.com`)

| Path | Purpose |
|---|---|
| `/login` | Magic-link sign-in |
| `/editor` | Block CMS editor |
| `/theme` | Brand theming |
| `/domains` · `/billing` | Custom domain (paid) · Stripe upgrade |
| `/ads` · `/ads/buy` | Campaign dashboard · buying wizard |
| `/moderation` | Manual ad approval queue (platform_admin) |
| `/participation` | Per-slot ad host opt-in/out |
| `/claim` | Acquisition claim + ownership verification |

> Server Actions on the control plane arrive via a host rewrite, so
> `next.config.ts` allow-lists the app host under
> `experimental.serverActions.allowedOrigins`; without it Next rejects the action
> POSTs as cross-origin.

### Stripe (live dev)

```bash
npm run stripe:listen       # forwards webhooks to /api/stripe/webhook
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:unit` | Vitest unit + integration tests |
| `npm run test:e2e` | Playwright E2E (starts the dev server automatically) |
| `npm run db:start` / `db:reset` / `gen:types` | Supabase local stack + types |
| `npm run stripe:listen` | Stripe webhook forwarding |

## Tests

- **Unit / integration** — `tests/unit/**` (Vitest). External services are
  injected and mocked; no Docker/network/secrets required.
- **E2E** — `tests/e2e/**` (Playwright). Pinned to the Chromium build matching
  `@playwright/test@1.56.1`; in CI the browser is installed via
  `npx playwright install`.

CI (`.github/workflows/ci.yml`) runs typecheck → unit → build → E2E on every
push and PR.

## Build phases

This repo is built in the phases defined in
[`docs/build-prompt.md`](docs/build-prompt.md) (Phase 0–9) and
[`docs/acquisition-module.md`](docs/acquisition-module.md) (Phase A–D). Each
phase has a test gate; the phase is not complete until its tests are green.
Progress is tracked in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Compliance

The outbound acquisition funnel (Phases A–D) builds provisional sites for
businesses and mails postcards **before** the owner opts in. Its legal posture
(trademark use, direct-mail regulation, data-source licensing) requires counsel
sign-off before any real send — see [`COUNSEL.md`](COUNSEL.md).
