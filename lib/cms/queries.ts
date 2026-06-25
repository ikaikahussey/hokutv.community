import type { Page } from "./types";
import { createSupabasePublicClient, isSupabaseConfigured } from "@/lib/supabase/public";
import { demoHomePage } from "./demo-data";

/**
 * Fetch a tenant's published home page for public rendering.
 *
 * With Supabase configured, this reads as `anon` so RLS guarantees only a
 * published page on a published tenant is returned (an unpublished page is
 * invisible → the route 404s). Without Supabase (sandbox/dev), it serves
 * generated demo content so the site renders.
 */
export async function getPublishedHomePage(subdomain: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) {
    return demoHomePage(subdomain);
  }

  const supabase = createSupabasePublicClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, is_published")
    .eq("subdomain", subdomain)
    .eq("is_published", true)
    .maybeSingle();

  if (!tenant) return null;

  const { data: page } = await supabase
    .from("pages")
    .select("id, tenant_id, slug, title, status, body_json")
    .eq("tenant_id", tenant.id)
    .eq("slug", "home")
    .eq("status", "published")
    .maybeSingle();

  return (page as Page | null) ?? null;
}
