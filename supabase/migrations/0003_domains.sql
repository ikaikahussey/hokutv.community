-- Custom domains (build-prompt §8, Phase 5). Tracks the Vercel add/verify/SSL
-- lifecycle for a tenant's custom domain. When a domain becomes active we mirror
-- it onto tenants.custom_domain so host routing resolves it like a subsite.

create table if not exists public.domains (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  hostname        text not null unique,
  vercel_domain_id text,
  ssl_status      text not null default 'pending'
                    check (ssl_status in ('pending', 'verifying', 'active', 'error')),
  verification    jsonb not null default '[]'::jsonb,  -- DNS records to add
  created_at      timestamptz not null default now()
);

create index if not exists domains_tenant_idx on public.domains (tenant_id);

grant select, insert, update, delete on public.domains to authenticated, service_role;

alter table public.domains enable row level security;

create policy domains_select on public.domains for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy domains_insert on public.domains for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy domains_update on public.domains for update to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy domains_delete on public.domains for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
