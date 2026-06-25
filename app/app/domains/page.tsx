"use client";

import { useActionState } from "react";
import { addDomainAction, type AddDomainState } from "./actions";

const initial: AddDomainState = { ok: false, message: "" };

export default function DomainsPage() {
  const [state, action, pending] = useActionState(addDomainAction, initial);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Custom domain</h1>
        <p className="mt-1 text-sm text-ink/60">
          Paid plans can connect their own domain. We issue SSL automatically and
          route it like your HOKU site.
        </p>
      </div>

      <form action={action} className="flex gap-2">
        <input
          name="hostname"
          required
          placeholder="www.yourbusiness.com"
          className="flex-1 rounded-md border border-brand-200 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-brand-foreground hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      {state.message ? (
        <div role="status" className="text-sm">
          <p className={state.ok ? "text-brand-700" : "text-red-600"}>
            {state.message}
          </p>
          {state.dns?.length ? (
            <ul className="mt-2 space-y-1 font-mono text-xs text-ink/80">
              {state.dns.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
