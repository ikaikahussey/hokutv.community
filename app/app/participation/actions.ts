"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import type { ParticipationRow } from "@/lib/ads/participation";

export interface SaveParticipationResult {
  ok: boolean;
  message: string;
}

/**
 * Persist a tenant's per-slot ad participation (build-prompt §8 — default
 * opt-in). RLS scopes the upsert to the current tenant. Demo mode echoes so the
 * UI is testable offline.
 */
export async function saveParticipation(
  rows: ParticipationRow[]
): Promise<SaveParticipationResult> {
  if (!isSupabaseConfigured()) {
    const off = rows.filter((r) => !r.enabled).map((r) => r.slotId);
    return {
      ok: true,
      message: off.length
        ? `Saved (demo). Opted out of: ${off.join(", ")}.`
        : "Saved (demo). Running ads in all slots.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: me } = await supabase
    .from("users")
    .select("tenant_id")
    .maybeSingle();
  const tenantId = (me as { tenant_id: string | null } | null)?.tenant_id;
  if (!tenantId) return { ok: false, message: "No tenant for current user." };

  const { error } = await supabase.from("ad_participation").upsert(
    rows.map((r) => ({
      tenant_id: tenantId,
      slot_type: r.slotId,
      enabled: r.enabled,
    })),
    { onConflict: "tenant_id,slot_type" }
  );
  if (error) return { ok: false, message: "Could not save participation." };
  return { ok: true, message: "Participation saved." };
}
