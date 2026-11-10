"use client";

import { useActionState } from "react";
import { runAuditAction, type ActionState } from "@/lib/actions/audits";

const initial: ActionState = {};

interface TargetOption {
  id: string;
  label: string;
  value: string;
}

export function RunAuditForm({
  targets,
  canRun,
}: {
  targets: TargetOption[];
  canRun: boolean;
}) {
  const [state, formAction, pending] = useActionState(runAuditAction, initial);

  return (
    <form action={formAction} className="card space-y-5">
      <div>
        <label className="label" htmlFor="name">Audit name</label>
        <input id="name" name="name" className="input" placeholder="Q4 HQ printer sweep" required />
      </div>

      <div>
        <span className="label">Select authorized targets</span>
        {targets.length === 0 ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            You have no authorized targets. Add and authorize targets first.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => (
              <label key={t.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-ink-900 p-3 text-sm">
                <input type="checkbox" name="targetIds" value={t.id} className="h-4 w-4 accent-brand-500" defaultChecked />
                <span className="font-medium text-white">{t.label}</span>
                <span className="font-mono text-slate-400">{t.value}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-ink-900 p-3 text-sm">
        <input type="checkbox" name="activeProbes" value="on" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-500" />
        <span className="text-slate-300">
          Enable active (still read-only) probes: PJL identity queries, SNMP default-community checks, and default
          web-credential tests. Uncheck for a lighter exposure-only scan.
        </span>
      </label>

      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !canRun || targets.length === 0}>
          {pending ? "Starting audit…" : "Run audit"}
        </button>
        {!canRun && <span className="text-sm text-amber-300">No credits — visit Billing.</span>}
      </div>
    </form>
  );
}
