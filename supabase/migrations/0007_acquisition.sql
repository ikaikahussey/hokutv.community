-- Acquisition funnel (acquisition-module.md §3). Internal/admin tables — NOT
-- tenant-scoped. The pipeline runs with service_role; platform_admin can read.
--
-- COMPLIANCE: this funnel builds provisional sites + mails postcards before an
-- owner opts in. Its legal posture requires counsel sign-off before any real
-- send — see COUNSEL.md. Guardrails here are minimal per direction.

create table if not exists public.acq_prospects (
  id            uuid primary key default gen_random_uuid(),
  place_id      text not null,
  tenant_id     uuid references public.tenants (id) on delete set null,
  business_name text not null,
  mail_address  jsonb not null,
  claim_token   text not null unique,
  postcard_id   text,
  status        text not null default 'site_generated'
                  check (status in ('site_generated', 'postcard_sent', 'claimed', 'rejected')),
  created_at    timestamptz not null default now()
);
create index if not exists acq_prospects_place_idx on public.acq_prospects (place_id);

create table if not exists public.acq_suppression (
  id         uuid primary key default gen_random_uuid(),
  place_id   text,
  zip        text,
  email      text,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists public.acq_claims (
  id                          uuid primary key default gen_random_uuid(),
  prospect_id                 uuid not null references public.acq_prospects (id) on delete cascade,
  tenant_id                   uuid references public.tenants (id) on delete set null,
  verified_via                text,
  verified_at                 timestamptz,
  paid                        boolean not null default false,
  stripe_payment_id           text,
  founder_credit_applied_cents integer not null default 0
);

grant select, insert, update, delete
  on public.acq_prospects, public.acq_suppression, public.acq_claims to service_role;

alter table public.acq_prospects  enable row level security;
alter table public.acq_suppression enable row level security;
alter table public.acq_claims      enable row level security;

-- Only platform admins may read these; the pipeline writes via service_role.
create policy acq_prospects_admin on public.acq_prospects for select to authenticated
  using (public.is_platform_admin());
create policy acq_suppression_admin on public.acq_suppression for select to authenticated
  using (public.is_platform_admin());
create policy acq_claims_admin on public.acq_claims for select to authenticated
  using (public.is_platform_admin());
