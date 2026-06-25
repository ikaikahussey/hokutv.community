"use client";

import { useActionState } from "react";
import { startCheckout, type BillingState } from "./actions";

const initial: BillingState = { ok: false, message: "" };

export default function BillingPage() {
  const [state, action, pending] = useActionState(startCheckout, initial);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Upgrade plan</h1>
        <p className="mt-1 text-sm text-ink/60">
          The paid plan unlocks a custom domain with automatic SSL. Billed
          through Stripe.
        </p>
      </div>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Upgrade — go to checkout"}
        </button>
      </form>
      {state.message ? (
        <p role="status" className="text-sm text-ink/70">
          {state.message}
        </p>
      ) : null}
    </main>
  );
}
