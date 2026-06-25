"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { createStripeClient, createCheckoutSession } from "@/lib/billing/stripe";

export interface BillingState {
  ok: boolean;
  message: string;
}

export async function startCheckout(
  _prev: BillingState,
  _form: FormData
): Promise<BillingState> {
  if (!isSupabaseConfigured() || !process.env.STRIPE_SECRET_KEY) {
    return { ok: false, message: "Demo mode — configure Stripe to upgrade." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: me } = await supabase
    .from("users")
    .select("tenant_id, email")
    .maybeSingle();
  const tenantId = (me as { tenant_id: string | null } | null)?.tenant_id;
  if (!tenantId) return { ok: false, message: "No tenant for current user." };

  const origin =
    process.env.APP_ORIGIN ?? `https://app.${process.env.APP_BASE_DOMAIN ?? "hoku.com"}`;
  const { url } = await createCheckoutSession(createStripeClient(), {
    tenantId,
    priceId: process.env.STRIPE_PRICE_CUSTOM_DOMAIN ?? "",
    successUrl: `${origin}/billing?status=success`,
    cancelUrl: `${origin}/billing?status=cancel`,
    customerEmail: (me as { email?: string } | null)?.email,
  });
  if (url) redirect(url);
  return { ok: false, message: "Could not start checkout." };
}
