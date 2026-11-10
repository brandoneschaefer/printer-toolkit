"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { externalCheckAction, type CheckState } from "@/lib/actions/check";
import { ExposureResult } from "@/components/ExposureResult";

const initial: CheckState = {};

export function CheckForm() {
  const [state, formAction, pending] = useActionState(externalCheckAction, initial);
  const r = state.result;

  return (
    <div className="space-y-6">
      <form action={formAction} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="domain">Company domain</label>
            <input id="domain" name="domain" className="input" placeholder="acme.com" required />
          </div>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" className="input" placeholder="you@acme.com" required />
          </div>
        </div>
        {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
        <button type="submit" className="btn-primary" disabled={pending}>
          <Search className="h-4 w-4" /> {pending ? "Checking…" : "Run free exposure check"}
        </button>
        <p className="text-xs text-slate-500">
          100% passive — we query public DNS, certificate transparency, and internet-scan data. We never connect to
          your network. No scanning, no disruption.
        </p>
      </form>

      {r && <ExposureResult result={r} />}
    </div>
  );
}
