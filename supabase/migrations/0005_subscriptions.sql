-- Billing (build-prompt §8/§9, Phase 7). Plain Stripe — tenant pays HOKU. One
-- subscription row per tenant; Stripe webhooks (service_role) keep it + the
-- tenant's plan in sync. Entitlements (e.g. custom domains) read tenants.plan.

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null unique references public.tenants (id) on delete cascade,
  stripe_customer        text,
  stripe_subscription_id text unique,
  plan                   text not null default 'free' check (plan in ('free', 'paid')),
  status                 text not null default 'active',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer);

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

-- Members may read their own subscription; writes happen via service_role
-- (the webhook), which bypasses RLS.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
