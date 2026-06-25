"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { createVercelClient } from "@/lib/integrations/vercel";
import {
  addCustomDomain,
  dnsInstructions,
  PlanGateError,
  type DomainsRepo,
} from "@/lib/domains/custom-domain";

export interface AddDomainState {
  ok: boolean;
  message: string;
  dns?: string[];
}

// Supabase-backed repo (RLS scopes writes to the caller's tenant).
function makeRepo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): DomainsRepo {
  return {
    async insertDomain(rec) {
      const { data, error } = await supabase
        .from("domains")
        .insert(rec)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as never;
    },
    async updateStatus(hostname, patch) {
      const { data } = await supabase
        .from("domains")
        .update(patch)
        .eq("hostname", hostname)
        .select()
        .maybeSingle();
      return (data as never) ?? null;
    },
    async setTenantCustomDomain(tenantId, hostname) {
      await supabase.from("tenants").update({ custom_domain: hostname }).eq("id", tenantId);
    },
  };
}

export async function addDomainAction(
  _prev: AddDomainState,
  formData: FormData
): Promise<AddDomainState> {
  const hostname = String(formData.get("hostname") ?? "");
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Demo mode — connect Supabase + Vercel to add a domain.",
    };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: me } = await supabase.from("users").select("tenant_id").maybeSingle();
    const tenantId = (me as { tenant_id: string | null } | null)?.tenant_id;
    if (!tenantId) return { ok: false, message: "No tenant for current user." };

    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", tenantId)
      .maybeSingle();

    const { record, dns } = await addCustomDomain({
      plan: (tenant as { plan: string } | null)?.plan ?? "free",
      tenantId,
      hostname,
      vercel: createVercelClient(),
      repo: makeRepo(supabase),
    });
    return {
      ok: true,
      message: `Added ${record.hostname} — status: ${record.ssl_status}. Add these DNS records:`,
      dns: dnsInstructions(dns),
    };
  } catch (e) {
    if (e instanceof PlanGateError) {
      return { ok: false, message: `${e.message}. Upgrade your plan to continue.` };
    }
    return { ok: false, message: e instanceof Error ? e.message : "Failed to add domain." };
  }
}
