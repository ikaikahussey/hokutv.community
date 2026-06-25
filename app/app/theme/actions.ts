"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import type { ThemeInput } from "@/lib/theme/tokens";

export interface SaveThemeResult {
  ok: boolean;
  message: string;
}

/** Persist the brand theme onto the signed-in owner's tenant (RLS-scoped). */
export async function saveTheme(theme: ThemeInput): Promise<SaveThemeResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Demo mode — not persisted (configure Supabase to save).",
    };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: me } = await supabase
      .from("users")
      .select("tenant_id")
      .maybeSingle();
    const tenantId = (me as { tenant_id: string | null } | null)?.tenant_id;
    if (!tenantId) return { ok: false, message: "No tenant for current user." };

    const { error } = await supabase
      .from("tenants")
      .update({ theme })
      .eq("id", tenantId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Theme saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
