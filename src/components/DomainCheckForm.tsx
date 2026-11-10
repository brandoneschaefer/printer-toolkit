"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { operatorCheckAction, type CheckState } from "@/lib/actions/check";
import { ExposureResult } from "@/components/ExposureResult";

const initial: CheckState = {};

export function DomainCheckForm() {
  const [state, formAction, pending] = useActionState(operatorCheckAction, initial);

  return (
    <div className="space-y-6">
      <form action={formAction} className="card space-y-3">
        <label className="label" htmlFor="domain">Domain to check</label>
        <div className="flex gap-3">
          <input id="domain" name="domain" className="input" placeholder="prospect.com" required />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            <Search className="h-4 w-4" /> {pending ? "Checking…" : "Check"}
          </button>
        </div>
        {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
        <p className="text-xs text-slate-500">
          Passive only — DNS, certificate transparency, and internet-scan data. No connection to the target, no email
          required, nothing logged as a lead.
        </p>
      </form>

      {state.result && <ExposureResult result={state.result} showCta={false} />}
    </div>
  );
}
