import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { BillingRepo } from "./webhook";

/**
 * Service-role billing repo used by the Stripe webhook. Writes bypass RLS
 * (the webhook is a trusted server path, build-prompt §5.2).
 */
export function createBillingRepo(): BillingRepo {
  const db = createSupabaseServiceClient();
  return {
    async upsertSubscription(rec) {
      await db.from("subscriptions").upsert(rec, { onConflict: "tenant_id" });
    },
    async setTenantPlan(tenantId, plan) {
      await db.from("tenants").update({ plan }).eq("id", tenantId);
    },
    async findTenantBySubscriptionId(stripeSubscriptionId) {
      const { data } = await db
        .from("subscriptions")
        .select("tenant_id")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle();
      return (data as { tenant_id: string } | null)?.tenant_id ?? null;
    },
    async findTenantByCustomer(stripeCustomer) {
      const { data } = await db
        .from("subscriptions")
        .select("tenant_id")
        .eq("stripe_customer", stripeCustomer)
        .maybeSingle();
      return (data as { tenant_id: string } | null)?.tenant_id ?? null;
    },
  };
}
