-- HOKU local seed (Definition of Done §11). Creates:
--   • a demo tenant on a subdomain with a themed, PUBLISHED site
--   • a directory entry (published + listed)
--   • a SECOND demo tenant that hosts ads (opted in)
--   • one LIVE ad (tenant A's campaign) serving on tenant B's site
--
-- Idempotent: re-runnable via `supabase db reset`. Auth users aren't seeded
-- here (Supabase Auth owns auth.users); sign in with a magic link, then map the
-- user to a tenant. Fixed UUIDs make the cross-references below stable.

-- ── Tenants ────────────────────────────────────────────────────────────────
insert into public.tenants (id, subdomain, plan, category, is_published, is_listed, theme, status)
values
  ('11111111-1111-1111-1111-111111111111', 'kalihi-coffee', 'paid', 'coffee', true, true,
   '{"primary":"#7a4b27","fontPairing":"friendly","layout":"bold"}'::jsonb, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'north-shore-surf', 'free', 'fitness', true, true,
   '{"primary":"#0e7490","fontPairing":"modern","layout":"starter"}'::jsonb, 'active')
on conflict (subdomain) do nothing;

-- ── Published home pages (block JSON the tenant route server-renders) ─────────
insert into public.pages (id, tenant_id, slug, title, body_json, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'home', 'Kalihi Coffee',
   '{"blocks":[
      {"id":"hero","type":"hero","heading":"Kalihi Coffee","subheading":"Small-batch roasts on King St.","cta":{"label":"Order ahead","href":"#contact"}},
      {"id":"services","type":"services","heading":"On the menu","items":[
        {"name":"Pour-over","description":"Single-origin, brewed to order."},
        {"name":"Cold brew","description":"18-hour steep, island sweet."}]},
      {"id":"hours","type":"hours","heading":"Hours","rows":[
        {"day":"Mon–Fri","hours":"6:00–15:00"},{"day":"Sat–Sun","hours":"7:00–13:00"}]},
      {"id":"contact","type":"contact","heading":"Visit","phone":"(808) 555-0142","address":"Kalihi, Honolulu, HI"}]}'::jsonb,
   'published'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'home', 'North Shore Surf',
   '{"blocks":[
      {"id":"hero","type":"hero","heading":"North Shore Surf","subheading":"Lessons & rentals, Haleʻiwa","cta":{"label":"Book a lesson","href":"#contact"}},
      {"id":"hours","type":"hours","heading":"Hours","rows":[{"day":"Daily","hours":"7:00–18:00"}]},
      {"id":"contact","type":"contact","heading":"Find us","phone":"(808) 555-0188","address":"Haleʻiwa, HI"}]}'::jsonb,
   'published')
on conflict (tenant_id, slug) do nothing;

-- ── Ad slots (config) ────────────────────────────────────────────────────────
insert into public.ad_slots (id, dimensions) values
  ('sidebar', '300x250'),
  ('footer', '728x90')
on conflict (id) do nothing;

-- ── Host participation: tenant B opts IN to running ads in its sidebar ────────
insert into public.ad_participation (tenant_id, slot_type, enabled) values
  ('22222222-2222-2222-2222-222222222222', 'sidebar', true)
on conflict (tenant_id, slot_type) do nothing;

-- ── Tenant A's creative + campaign (the advertiser) ──────────────────────────
insert into public.ad_creatives
  (id, tenant_id, headline, subtext, cta_label, destination_url, layout_variant, brand_snapshot_json, status)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'Try Kalihi Coffee', '10% off your first order', 'Order now',
   'https://kalihi-coffee.hokusites.com', 'a',
   '{"--brand-600":"#7a4b27","--brand-700":"#633c1f","--brand-50":"#f6efe9","--brand-foreground":"#ffffff"}'::jsonb,
   'approved')
on conflict (id) do nothing;

insert into public.ad_campaigns
  (id, tenant_id, creative_id, package, targeting_json, budget_cents, spend_cents, status, stripe_payment_id)
values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'growth', '{}'::jsonb, 7500, 310, 'active', 'pi_demo_seed')
on conflict (id) do nothing;

-- ── One live impression already served on tenant B's site (seeds the rollup) ──
insert into public.ad_events (id, campaign_id, host_tenant_id, slot, type, context_json) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '22222222-2222-2222-2222-222222222222', 'sidebar', 'impression', '{"category":"fitness"}'::jsonb)
on conflict (id) do nothing;
