import type { Page } from "./types";
import { createSupabasePublicClient, isSupabaseConfigured } from "@/lib/supabase/public";
import { demoHomePage } from "./demo-data";
import {
  buildThemeVars,
  colorFromSeed,
  DEFAULT_THEME_INPUT,
  type ThemeInput,
} from "@/lib/theme/tokens";

export interface PublishedSite {
  page: Page;
  /** CSS custom properties to scope on the tenant subtree (brand tokens). */
  themeVars: Record<string, string>;
}

/**
 * Fetch a tenant's published home page together with its derived brand tokens.
 * Theme lives on `tenants.theme` (Phase 4 input shape); in demo mode a stable
 * per-subdomain color is generated so each demo site looks distinct.
 */
export async function getPublishedSite(subdomain: string): Promise<PublishedSite | null> {
  if (!isSupabaseConfigured()) {
    return {
      page: demoHomePage(subdomain),
      themeVars: buildThemeVars({
        ...DEFAULT_THEME_INPUT,
        primary: colorFromSeed(subdomain),
      }),
    };
  }

  const supabase = createSupabasePublicClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, theme")
    .eq("subdomain", subdomain)
    .eq("is_published", true)
    .maybeSingle();
  if (!tenant) return null;

  const { data: page } = await supabase
    .from("pages")
    .select("id, tenant_id, slug, title, status, body_json")
    .eq("tenant_id", (tenant as { id: string }).id)
    .eq("slug", "home")
    .eq("status", "published")
    .maybeSingle();
  if (!page) return null;

  const themeInput = {
    ...DEFAULT_THEME_INPUT,
    ...((tenant as { theme?: Partial<ThemeInput> }).theme ?? {}),
  } as ThemeInput;

  return { page: page as Page, themeVars: buildThemeVars(themeInput) };
}

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
