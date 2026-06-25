"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, message: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-ink">
          Sign in to HOKU
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          We&apos;ll email you a one-time sign-in link. No password.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@business.com"
          className="rounded-md border border-brand-200 px-3 py-2 text-ink outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Email me a link"}
        </button>
      </form>

      {state.message ? (
        <p
          role="status"
          className={
            state.ok ? "text-sm text-brand-700" : "text-sm text-red-600"
          }
        >
          {state.message}
        </p>
      ) : null}
    </main>
  );
}
