# Deploying HOKU

HOKU is a standard Next.js (App Router) app on the **Vercel** stack. It runs in
two modes:

- **Demo mode** — no external services. The app is fully built and serves
  generated demo data (marketing apex, directory, tenant sites, ad serving, and
  the admin wizards). Good for a first deploy / preview.
- **Full mode** — Supabase (DB/Auth/Storage), Stripe (billing + ad payments),
  Vercel Domains (custom-domain SSL), and optional Anthropic (ad copy) are wired
  via env vars.

> **Verified deployable.** `next build` + `next start` serve every route
> (apex `200`, control plane `200`, tenant subsite `200`, `/api/serve` returns
> live JSON, unknown host `404`, security headers present). CI runs the full
> gate on every push.

---

## Option A — Vercel via Git (recommended, demo mode first)

No secrets are shared with anyone; Vercel builds from GitHub.

1. **Merge to `main`** (this is the deploy trigger once the repo is connected).
2. In the **Vercel dashboard** → *Add New… → Project* → import
   `ikaikahussey/hokutv.community`. Framework autodetects as **Next.js**; no
   build settings needed.
3. **Deploy.** Vercel builds and serves the production URL
   `https://<project>.vercel.app`.
   - The app auto-detects that URL as the marketing **apex** (via
     `VERCEL_PROJECT_PRODUCTION_URL`), so the homepage + `/directory` render with
     demo data out of the box — no env vars required.
4. Every later push to `main` redeploys automatically; PRs get preview
   deployments.

That's the full extent of "demo mode first." To reach the **control plane**,
**ad serving**, and **tenant subsites** you need their hosts — see Option B
(they live on separate domains by design; see the security note below).

> Preview deployments have a per-deploy URL that differs from the production
> URL, so the apex auto-detection only applies to the production deployment.
> Set `APP_BASE_DOMAIN` (below) to pin it.

---

## Option B — Full production (real domains + services)

### 1. Domains (the load-bearing security boundary — do not collapse)

The architecture intentionally uses **two registrable domains** so the browser
treats tenant content as cross-site and the auth cookie stays host-only to the
control plane. Add all of these to the Vercel project and point DNS at Vercel:

| Host | Zone | Notes |
|---|---|---|
| `hoku.com` (+ `www`) | Marketing + directory (apex) | trusted |
| `app.hoku.com` | Auth, admin, CMS, ad-buying | trusted; session cookie lives here |
| `ads.hoku.com` | Ad serving + tracking | isolated, unauthenticated |
| `*.hokusites.com` | Tenant subsites | **separate eTLD+1** (wildcard domain) |
| custom domains | Paid tenants | added per-tenant via the Vercel Domains API |

`*.hokusites.com` must be registered separately and added as a **wildcard
domain** in Vercel. Custom tenant domains are provisioned automatically through
the Domains API (`lib/integrations/vercel.ts`) when a paid tenant adds one.

### 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Non-secret routing (set these for full mode so hosts resolve correctly):

```
APP_BASE_DOMAIN=hoku.com
TENANT_BASE_DOMAIN=hokusites.com
ADS_HOST=ads.hoku.com
```

Services (secrets — never commit; see `.env.example` for the full list):

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_CUSTOM_DOMAIN
VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID      # custom-domain automation
ANTHROPIC_API_KEY                                    # optional ad-copy suggestions
```

The app degrades gracefully: if `NEXT_PUBLIC_SUPABASE_URL` is unset it stays in
demo mode; Stripe/Anthropic features no-op with a clear message until keyed.

### 3. Supabase

```bash
supabase link --project-ref <ref>
supabase db push        # apply supabase/migrations/*.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo data (idempotent)
npm run gen:types       # regenerate lib/supabase/database.types.ts
```

### 4. Stripe

- Create the products/prices; set `STRIPE_PRICE_CUSTOM_DOMAIN`.
- Add a webhook endpoint → `https://app.hoku.com/api/stripe/webhook`; set
  `STRIPE_WEBHOOK_SECRET`.

### 5. Verify after deploy

```
curl -I https://hoku.com/                      # apex 200
curl -I https://app.hoku.com/login             # control plane 200
curl -s "https://ads.hoku.com/api/serve?slot=sidebar"   # ad JSON or 204
```

---

## Notes

- **Server Actions:** the control plane is reached via a host rewrite, so action
  POSTs carry `x-forwarded-host: app.<base>`. `next.config.ts` allow-lists the
  app host under `experimental.serverActions.allowedOrigins`; update it if you
  change `APP_BASE_DOMAIN`.
- **Acquisition funnel:** the inbound claim flow is live; **outbound** postcard /
  OTP *delivery* stays disabled pending counsel sign-off — see `COUNSEL.md`.
- **No Docker required** to deploy on Vercel. For container hosts (Fly / Cloud
  Run / Render), add `output: "standalone"` to `next.config.ts` and a Dockerfile.
