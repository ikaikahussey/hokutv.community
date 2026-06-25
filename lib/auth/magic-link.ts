import { z } from "zod";

/**
 * Magic-link (passwordless) auth logic, build-prompt §2 / Phase 2.
 *
 * The Supabase calls are isolated behind a tiny `OtpClient` interface so the
 * flow is unit-testable without the hosted Auth service. The thin server
 * action + callback route wire the real Supabase client into these helpers.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Minimal surface of the Supabase auth client this module needs. */
export interface OtpClient {
  auth: {
    signInWithOtp(args: {
      email: string;
      options?: { emailRedirectTo?: string };
    }): Promise<{ error: { message: string } | null }>;
    exchangeCodeForSession(
      code: string
    ): Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Where the magic link returns to — always the control-plane host
 * (app.<base>/auth/callback), so the session cookie is set host-only there.
 * `APP_ORIGIN` overrides for local dev (e.g. http://app.hoku.localhost:3000).
 */
export function magicLinkRedirectUrl(
  env: Record<string, string | undefined> = process.env
): string {
  if (env.APP_ORIGIN) {
    return `${env.APP_ORIGIN.replace(/\/$/, "")}/auth/callback`;
  }
  const base = env.APP_BASE_DOMAIN ?? "hoku.com";
  const proto = base === "localhost" || base.endsWith(".localhost") ? "http" : "https";
  return `${proto}://app.${base}/auth/callback`;
}

export async function requestMagicLink(
  client: OtpClient,
  rawEmail: string,
  redirectTo: string
): Promise<{ email: string }> {
  const email = emailSchema.parse(rawEmail);
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw new Error(error.message);
  return { email };
}

export async function completeAuth(client: OtpClient, code: string): Promise<void> {
  if (!code) throw new Error("Missing auth code");
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}
