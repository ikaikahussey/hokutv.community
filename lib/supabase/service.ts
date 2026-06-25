import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — **bypasses RLS**. Use ONLY on trusted server paths that
 * legitimately need cross-tenant access: ad serving, event rollups, the
 * acquisition pipeline's provisioning, and webhook handlers. Never expose this
 * to the browser and never use it to satisfy a tenant-scoped read that RLS
 * should handle (build-prompt §5.2).
 */
export function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
