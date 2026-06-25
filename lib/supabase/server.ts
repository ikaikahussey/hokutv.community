import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components / Actions / Route Handlers, backed by
 * the request cookie jar. The auth cookie it manages is host-only to
 * app.hoku.com (the control plane) — see build-prompt §3 and lib/auth/cookie.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            // No `domain` is passed → host-only scoping is preserved.
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll is called from a Server Component render where cookies are
          // read-only; safe to ignore — the middleware/route refreshes them.
        }
      },
    },
  });
}
