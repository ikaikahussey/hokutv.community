import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeAuth, type OtpClient } from "@/lib/auth/magic-link";

/**
 * Magic-link landing (external path /auth/callback on app.hoku.com, rewritten
 * internally to /app/auth/callback). Exchanges the one-time code for a session,
 * which sets the host-only auth cookie, then redirects into the app.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  try {
    const supabase = (await createSupabaseServerClient()) as unknown as OtpClient;
    await completeAuth(supabase, code);
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth", req.url));
  }

  return NextResponse.redirect(new URL(next, req.url));
}
