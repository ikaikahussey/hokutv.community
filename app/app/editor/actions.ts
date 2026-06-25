"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import type { PageDoc, PageStatus } from "@/lib/cms/types";

export interface SaveResult {
  ok: boolean;
  message: string;
}

/**
 * Persist a page for the signed-in owner's tenant. RLS guarantees the upsert is
 * scoped to the caller's tenant. In the sandbox (no Supabase) this is a no-op
 * with a clear message — the editing logic itself is covered by page-ops unit
 * tests and the DB-level CRUD by the pages RLS test.
 */
export async function savePage(input: {
  slug: string;
  title: string;
  status: PageStatus;
  body_json: PageDoc;
}): Promise<SaveResult> {
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

    const { error } = await supabase.from("pages").upsert(
      {
        tenant_id: tenantId,
        slug: input.slug,
        title: input.title,
        status: input.status,
        body_json: input.body_json,
      },
      { onConflict: "tenant_id,slug" }
    );
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
