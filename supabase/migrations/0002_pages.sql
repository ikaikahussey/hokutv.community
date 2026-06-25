-- CMS pages (build-prompt §8). Block content lives in body_json. RLS scopes
-- editing to tenant members; the public (anon) may read only a PUBLISHED page on
-- a PUBLISHED tenant — so unpublished pages 404 publicly.

create table if not exists public.pages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  slug       text not null,
  title      text not null default '',
  body_json  jsonb not null default '{"blocks":[]}'::jsonb,
  status     text not null default 'draft'
               check (status in ('draft', 'provisional', 'published')),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists pages_tenant_idx on public.pages (tenant_id);

-- Bypasses RLS (SECURITY DEFINER) so the anon page policy can check tenant
-- publication without depending on the tenants-table policy.
create or replace function public.tenant_is_published(t uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenants where id = t and is_published)
$$;

create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger pages_touch_updated_at
  before update on public.pages
  for each row execute function public.touch_updated_at();

grant select on public.pages to anon, authenticated;
grant insert, update, delete on public.pages to authenticated, service_role;

alter table public.pages enable row level security;

-- anon: only published pages of published tenants.
create policy pages_anon_select on public.pages for select to anon
  using (status = 'published' and public.tenant_is_published(tenant_id));

-- members: their own tenant's pages (any status) + publicly-visible pages.
create policy pages_select on public.pages for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    or public.is_platform_admin()
    or (status = 'published' and public.tenant_is_published(tenant_id))
  );

create policy pages_insert on public.pages for insert to authenticated
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy pages_update on public.pages for update to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

create policy pages_delete on public.pages for delete to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
