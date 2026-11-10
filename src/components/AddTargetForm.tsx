"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTargetAction, type ActionState } from "@/lib/actions/targets";

const initial: ActionState = {};

export function AddTargetForm() {
  const [state, formAction, pending] = useActionState(createTargetAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4">
      <h2 className="font-semibold text-white">Add a target</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="label">Label</label>
          <input id="label" name="label" className="input" placeholder="HQ 3rd floor MFPs" required />
        </div>
        <div>
          <label className="label" htmlFor="value">Host or CIDR</label>
          <input id="value" name="value" className="input" placeholder="10.0.4.0/28 or printer.acme.com" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <input id="notes" name="notes" className="input" placeholder="Authorization ticket #, owner, etc." />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-ink-900 p-3 text-sm">
        <input type="checkbox" name="authorized" className="mt-0.5 h-4 w-4 accent-brand-500" />
        <span className="text-slate-300">
          I confirm my organization <strong className="text-white">owns or is explicitly authorized</strong> to
          perform security testing against this host/range. Scanning systems without authorization may be illegal.
        </span>
      </label>

      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">Target added.</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add target"}
      </button>
    </form>
  );
}
