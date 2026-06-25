import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous, session-less Supabase client for public reads (tenant sites, the
 * directory). RLS as `anon` governs visibility — only published/listed content
 * is returned — so this is safe to use on unauthenticated, cacheable paths.
 */
export function createSupabasePublicClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Whether a live Supabase project is configured (vs. local demo mode). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  );
}
