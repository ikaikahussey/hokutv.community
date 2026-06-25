-- HOKU Ads (build-prompt §8, Phase 8). Creatives + campaigns are tenant-scoped
-- (RLS). Serving writes raw ad_events and rollups roll them up hourly; those run
-- with service_role only. Hosts opt in/out per slot (default opt-in).

create table if not exists public.ad_slots (
  id         text primary key,            -- e.g. 'sidebar', 'footer'
  dimensions text not null
);

create table if not exists public.ad_creatives (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  headline           text not null,
  subtext            text,
  cta_label          text not null default 'Learn more',
  destination_url    text not null,
  layout_variant     text not null default 'a',
  brand_snapshot_json jsonb not null default '{}'::jsonb,
  status             text not null default 'draft'
                       check (status in ('draft', 'pending', 'approved', 'rejected')),
  created_at         timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  creative_id      uuid not null references public.ad_creatives (id) on delete cascade,
  package          text not null,
  targeting_json   jsonb not null default '{}'::jsonb,
  budget_cents     integer not null default 0,
  spend_cents      integer not null default 0,
  start_date       date,
  end_date         date,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'active', 'paused', 'completed', 'rejected')),
  stripe_payment_id text,
  created_at       timestamptz not null default now()
);

create table if not exists public.ad_participation (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slot_type text not null references public.ad_slots (id),
  enabled   boolean not null default true,
  primary key (tenant_id, slot_type)
);

create table if not exists public.ad_events (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.ad_campaigns (id) on delete cascade,
  host_tenant_id uuid references public.tenants (id) on delete set null,
  slot           text,
  type           text not null check (type in ('impression', 'click')),
  context_json   jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.ad_event_rollups (
  campaign_id    uuid not null references public.ad_campaigns (id) on delete cascade,
  host_tenant_id uuid,
  hour           timestamptz not null,
  impressions    integer not null default 0,
  clicks         integer not null default 0,
  primary key (campaign_id, host_tenant_id, hour)
);

create index if not exists ad_campaigns_tenant_idx on public.ad_campaigns (tenant_id);
create index if not exists ad_creatives_tenant_idx on public.ad_creatives (tenant_id);
create index if not exists ad_events_campaign_idx on public.ad_events (campaign_id);

-- Grants
grant select on public.ad_slots to anon, authenticated, service_role;
grant select, insert, update, delete on public.ad_creatives, public.ad_campaigns, public.ad_participation
  to authenticated, service_role;
grant select, insert, update, delete on public.ad_events, public.ad_event_rollups to service_role;
grant select on public.ad_campaigns, public.ad_creatives to service_role;

-- RLS
alter table public.ad_creatives    enable row level security;
alter table public.ad_campaigns    enable row level security;
alter table public.ad_participation enable row level security;
alter table public.ad_events       enable row level security;
alter table public.ad_event_rollups enable row level security;

-- creatives + campaigns: owning tenant only (platform_admin sees all).
create policy ad_creatives_rw on public.ad_creatives for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy ad_campaigns_rw on public.ad_campaigns for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy ad_participation_rw on public.ad_participation for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- ad_events + rollups: no authenticated access (service_role only — serving and
-- dashboards read rollups via the service path). RLS enabled with no policy =>
-- authenticated/anon see nothing.
