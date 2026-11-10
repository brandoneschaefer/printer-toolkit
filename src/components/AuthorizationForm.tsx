"use client";

import { useActionState } from "react";
import { createAuthorizationAction, type AuthorizationActionState } from "@/lib/actions/authorization";

const initial: AuthorizationActionState = {};

export function AuthorizationForm({ statement, defaultEmail }: { statement: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(createAuthorizationAction, initial);

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-semibold text-white">Authorize security testing</h2>
      <p className="text-sm text-slate-400">
        A signed authorization must be on file before any audit can run. Record the person authorizing testing and
        the scope they are authorizing.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="signerName">Authorized by (full name)</label>
          <input id="signerName" name="signerName" className="input" placeholder="Jordan Lee" required />
        </div>
        <div>
          <label className="label" htmlFor="signerTitle">Title / role</label>
          <input id="signerTitle" name="signerTitle" className="input" placeholder="IT Director" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="signerEmail">Email</label>
        <input id="signerEmail" name="signerEmail" type="email" className="input" defaultValue={defaultEmail} placeholder="jordan@company.com" required />
      </div>
      <div>
        <label className="label" htmlFor="scope">Authorized scope</label>
        <textarea id="scope" name="scope" className="input min-h-[80px]" placeholder="e.g. All printer subnets at HQ (10.0.4.0/24) and the Dallas branch (192.168.20.0/24)." required />
      </div>

      <div className="rounded-lg border border-white/10 bg-ink-900 p-3 text-sm text-slate-300">
        {statement}
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-300">
        <input type="checkbox" name="accept" className="mt-0.5 h-4 w-4 accent-brand-500" required />
        <span>I have read and agree to the authorization statement above, and I am empowered to grant it.</span>
      </label>

      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">Authorization recorded.</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Recording…" : "Sign authorization"}
      </button>
    </form>
  );
}
