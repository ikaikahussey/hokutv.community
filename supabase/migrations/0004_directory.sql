-- Public visibility for the directory + tenant-site rendering (Phase 6).
-- Anon may read PUBLISHED tenants (their sites are public anyway). The directory
-- query additionally filters is_listed; tenant-site rendering uses is_published.

create policy tenants_anon_select on public.tenants for select to anon
  using (is_published);

-- Helpful index for directory grouping/filtering.
create index if not exists tenants_listed_idx
  on public.tenants (category)
  where is_published and is_listed;
