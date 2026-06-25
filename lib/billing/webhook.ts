/**
 * Pure Stripe webhook interpreter (Phase 7). Maps the events that change a
 * tenant's entitlements onto plan/subscription state via an injected repo, so
 * "checkout upgrades the plan" and "cancel reverts" are unit-testable with
 * synthetic Stripe events — no live Stripe needed. Signature verification lives
 * in the route; this handles already-verified events.
 */
export type Plan = "free" | "paid";

export interface SubscriptionUpsert {
  tenant_id: string;
  stripe_customer?: string | null;
  stripe_subscription_id?: string | null;
  plan: Plan;
  status: string;
  current_period_end?: string | null;
}

export interface BillingRepo {
  upsertSubscription(rec: SubscriptionUpsert): Promise<void>;
  setTenantPlan(tenantId: string, plan: Plan): Promise<void>;
  findTenantBySubscriptionId(stripeSubscriptionId: string): Promise<string | null>;
  findTenantByCustomer(stripeCustomer: string): Promise<string | null>;
}

// Minimal shape of the Stripe event objects we consume.
interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function planForStatus(status: string, cancelAtPeriodEnd?: boolean): Plan {
  if (cancelAtPeriodEnd) return "free";
  return ACTIVE_STATUSES.has(status) ? "paid" : "free";
}

function toIso(epochSeconds: unknown): string | null {
  return typeof epochSeconds === "number"
    ? new Date(epochSeconds * 1000).toISOString()
    : null;
}

export interface ApplyResult {
  tenantId: string;
  plan: Plan;
  handled: true;
}

/**
 * Apply a verified Stripe event. Returns the resulting tenant+plan, or null for
 * events we don't act on.
 */
export async function applyStripeEvent(
  event: StripeEvent,
  repo: BillingRepo
): Promise<ApplyResult | null> {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const tenantId =
        ((obj.metadata as Record<string, string> | undefined)?.tenant_id) ??
        (obj.client_reference_id as string | undefined) ??
        null;
      if (!tenantId) return null;
      await repo.upsertSubscription({
        tenant_id: tenantId,
        stripe_customer: (obj.customer as string) ?? null,
        stripe_subscription_id: (obj.subscription as string) ?? null,
        plan: "paid",
        status: "active",
      });
      await repo.setTenantPlan(tenantId, "paid");
      return { tenantId, plan: "paid", handled: true };
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subId = obj.id as string;
      const tenantId =
        ((obj.metadata as Record<string, string> | undefined)?.tenant_id) ??
        (await repo.findTenantBySubscriptionId(subId)) ??
        (obj.customer
          ? await repo.findTenantByCustomer(obj.customer as string)
          : null);
      if (!tenantId) return null;

      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : (obj.status as string);
      const plan = planForStatus(status, Boolean(obj.cancel_at_period_end));

      await repo.upsertSubscription({
        tenant_id: tenantId,
        stripe_customer: (obj.customer as string) ?? null,
        stripe_subscription_id: subId,
        plan,
        status,
        current_period_end: toIso(obj.current_period_end),
      });
      await repo.setTenantPlan(tenantId, plan);
      return { tenantId, plan, handled: true };
    }

    default:
      return null;
  }
}
