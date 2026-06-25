import Stripe from "stripe";

/** Stripe client (plain Stripe, not Connect — build-prompt §9). */
export function createStripeClient(
  env: Record<string, string | undefined> = process.env
): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY ?? "");
}

export interface CheckoutParams {
  tenantId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

/**
 * Create a subscription Checkout session for the custom-domain (paid) tier.
 * tenant_id is carried in both client_reference_id and metadata so the webhook
 * can map the resulting subscription back to the tenant.
 */
export async function createCheckoutSession(
  stripe: Stripe,
  p: CheckoutParams
): Promise<{ url: string | null; id: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: p.priceId, quantity: 1 }],
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    client_reference_id: p.tenantId,
    customer_email: p.customerEmail,
    metadata: { tenant_id: p.tenantId },
    subscription_data: { metadata: { tenant_id: p.tenantId } },
  });
  return { url: session.url, id: session.id };
}
