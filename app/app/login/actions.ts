"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestMagicLink,
  magicLinkRedirectUrl,
  type OtpClient,
} from "@/lib/auth/magic-link";

export interface LoginState {
  ok: boolean;
  message: string;
}

/**
 * Server action: send a passwordless magic link to the submitted email. Used by
 * the login form via `useActionState`. The actual Supabase round trip needs the
 * hosted Auth service; the link logic is unit-tested in tests/unit/magic-link.
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    const supabase = (await createSupabaseServerClient()) as unknown as OtpClient;
    const { email: normalized } = await requestMagicLink(
      supabase,
      email,
      magicLinkRedirectUrl()
    );
    return { ok: true, message: `Check ${normalized} for your sign-in link.` };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not send the sign-in link.";
    return { ok: false, message };
  }
}
