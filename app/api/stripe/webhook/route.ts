import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/billing/stripe";
import { applyStripeEvent } from "@/lib/billing/webhook";
import { createBillingRepo } from "@/lib/billing/repo";

/**
 * Stripe webhook (configure Stripe to POST to hoku.com/api/stripe/webhook).
 * Verifies the signature, then applies the event to plan/subscription state.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET ?? ""
    );
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    await applyStripeEvent(
      event as unknown as Parameters<typeof applyStripeEvent>[0],
      createBillingRepo()
    );
  } catch (e) {
    return new NextResponse(
      `Handler error: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
