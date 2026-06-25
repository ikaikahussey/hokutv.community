import { describe, it, expect, vi } from "vitest";
import {
  applyStripeEvent,
  type BillingRepo,
  type SubscriptionUpsert,
} from "@/lib/billing/webhook";
import { assertCanAddCustomDomain, PlanGateError } from "@/lib/domains/custom-domain";

function fakeRepo(seedSub?: { id: string; tenantId: string; customer?: string }) {
  const plans: Record<string, string> = {};
  const subs: SubscriptionUpsert[] = [];
  if (seedSub) {
    subs.push({
      tenant_id: seedSub.tenantId,
      stripe_subscription_id: seedSub.id,
      stripe_customer: seedSub.customer ?? null,
      plan: "paid",
      status: "active",
    });
  }
  const repo: BillingRepo = {
    upsertSubscription: vi.fn(async (r) => {
      const i = subs.findIndex((s) => s.tenant_id === r.tenant_id);
      if (i >= 0) subs[i] = r;
      else subs.push(r);
    }),
    setTenantPlan: vi.fn(async (t, p) => {
      plans[t] = p;
    }),
    findTenantBySubscriptionId: vi.fn(
      async (id) => subs.find((s) => s.stripe_subscription_id === id)?.tenant_id ?? null
    ),
    findTenantByCustomer: vi.fn(
      async (c) => subs.find((s) => s.stripe_customer === c)?.tenant_id ?? null
    ),
  };
  return { repo, plans, subs };
}

const checkoutCompleted = {
  type: "checkout.session.completed",
  data: {
    object: {
      metadata: { tenant_id: "t1" },
      customer: "cus_1",
      subscription: "sub_1",
    },
  },
};

describe("applyStripeEvent", () => {
  it("checkout upgrades the tenant to paid", async () => {
    const { repo, plans } = fakeRepo();
    const res = await applyStripeEvent(checkoutCompleted, repo);
    expect(res).toMatchObject({ tenantId: "t1", plan: "paid" });
    expect(plans["t1"]).toBe("paid");
    expect(repo.upsertSubscription).toHaveBeenCalled();
  });

  it("subscription deletion reverts to free", async () => {
    const { repo, plans } = fakeRepo({ id: "sub_1", tenantId: "t1", customer: "cus_1" });
    await applyStripeEvent(
      { type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1" } } },
      repo
    );
    expect(plans["t1"]).toBe("free");
  });

  it("active subscription update keeps paid; cancel_at_period_end and bad status revert", async () => {
    const seed = () => fakeRepo({ id: "sub_1", tenantId: "t1" });

    const a = seed();
    await applyStripeEvent(
      { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "active" } } },
      a.repo
    );
    expect(a.plans["t1"]).toBe("paid");

    const b = seed();
    await applyStripeEvent(
      {
        type: "customer.subscription.updated",
        data: { object: { id: "sub_1", status: "active", cancel_at_period_end: true } },
      },
      b.repo
    );
    expect(b.plans["t1"]).toBe("free");

    const c = seed();
    await applyStripeEvent(
      { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "past_due" } } },
      c.repo
    );
    expect(c.plans["t1"]).toBe("free");
  });

  it("maps a subscription to a tenant by id when metadata is absent", async () => {
    const { repo, plans } = fakeRepo({ id: "sub_9", tenantId: "t9" });
    await applyStripeEvent(
      { type: "customer.subscription.deleted", data: { object: { id: "sub_9" } } },
      repo
    );
    expect(plans["t9"]).toBe("free");
  });

  it("ignores unrelated events", async () => {
    const { repo } = fakeRepo();
    expect(await applyStripeEvent({ type: "invoice.paid", data: { object: {} } }, repo)).toBeNull();
  });
});

describe("custom-domain gate flips with plan (Phase 5 + 7)", () => {
  it("opens after checkout and closes after cancel", async () => {
    const { repo, plans } = fakeRepo();
    await applyStripeEvent(checkoutCompleted, repo);
    expect(() => assertCanAddCustomDomain(plans["t1"])).not.toThrow();

    await applyStripeEvent(
      { type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1" } } },
      repo
    );
    expect(() => assertCanAddCustomDomain(plans["t1"])).toThrow(PlanGateError);
  });
});
