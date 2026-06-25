-- HOKU base schema — tenants + users, with RLS for tenant isolation.
-- Portable to real Supabase (which provides the `auth` schema, `auth.uid()`,
-- and the anon/authenticated/service_role roles). The PGlite test harness
-- installs a compatible `auth` shim before applying this migration.
--
-- Build-prompt §5.2 (RLS by default) and §8 (data model).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  subdomain     text not null unique,
  custom_domain text unique,
  plan          text not null default 'free' check (plan in ('free', 'paid')),
  category      text,
  is_published  boolean not null default false,
  is_listed     boolean not null default false,
  theme         jsonb not null default '{}'::jsonb,
  status        text not null default 'active'
                  check (status in ('active', 'provisional', 'suspended')),
  created_at    timestamptz not null default now()
);

-- App-level membership + role. `id` IS the Supabase auth user id.
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  tenant_id  uuid references public.tenants (id) on delete cascade,
  email      text not null,
  role       text not null default 'owner'
               check (role in ('owner', 'staff', 'platform_admin')),
  created_at timestamptz not null default now()
);

create index if not exists users_tenant_id_idx on public.users (tenant_id);
create index if not exists tenants_category_idx on public.tenants (category);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS on public.users and
-- don't recurse through the very policies that call them).
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.users where id = auth.uid()
$$;

create or replace function public.is_platform_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'platform_admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- Privileges. RLS filters on top of these grants; service_role bypasses RLS.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.tenants to authenticated, service_role;
grant select, insert, update, delete on public.users   to authenticated, service_role;
-- anon may SELECT tenants (for the public directory in Phase 6); RLS still
-- governs which rows are visible (no anon policy yet → none until published).
grant select on public.tenants to anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.users   enable row level security;

-- tenants: a member sees/edits only their own tenant; platform_admin sees all.
create policy tenants_select on public.tenants for select to authenticated
  using (id = public.current_tenant_id() or public.is_platform_admin());

create policy tenants_update on public.tenants for update to authenticated
  using (id = public.current_tenant_id() or public.is_platform_admin())
  with check (id = public.current_tenant_id() or public.is_platform_admin());

create policy tenants_insert on public.tenants for insert to authenticated
  with check (public.is_platform_admin());

create policy tenants_delete on public.tenants for delete to authenticated
  using (public.is_platform_admin());

-- users: read your own row + co-members of your tenant; platform_admin all.
create policy users_select on public.users for select to authenticated
  using (
    id = auth.uid()
    or tenant_id = public.current_tenant_id()
    or public.is_platform_admin()
  );

create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

create policy users_insert on public.users for insert to authenticated
  with check (public.is_platform_admin());

create policy users_delete on public.users for delete to authenticated
  using (public.is_platform_admin());
