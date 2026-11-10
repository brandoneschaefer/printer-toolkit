"use client";

import { useActionState, useState } from "react";
import { runAuditAction, type ActionState } from "@/lib/actions/audits";

const initial: ActionState = {};

interface TargetOption {
  id: string;
  label: string;
  value: string;
}

interface CollectorOption {
  id: string;
  name: string;
  online: boolean;
}

export function RunAuditForm({
  targets,
  collectors,
  canRun,
}: {
  targets: TargetOption[];
  collectors: CollectorOption[];
  canRun: boolean;
}) {
  const [state, formAction, pending] = useActionState(runAuditAction, initial);
  const [executor, setExecutor] = useState<"CLOUD" | "COLLECTOR">("CLOUD");

  return (
    <form action={formAction} className="card space-y-5">
      <div>
        <label className="label" htmlFor="name">Audit name</label>
        <input id="name" name="name" className="input" placeholder="Q4 HQ printer sweep" required />
      </div>

      {/* Execution mode */}
      <div>
        <span className="label">Where should this scan run?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-lg border p-3 text-sm ${executor === "CLOUD" ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-ink-900"}`}>
            <input type="radio" name="executor" value="CLOUD" className="sr-only" checked={executor === "CLOUD"} onChange={() => setExecutor("CLOUD")} />
            <div className="font-medium text-white">Cloud scan</div>
            <div className="mt-1 text-xs text-slate-400">For internet-reachable targets. Runs immediately on PRET.</div>
          </label>
          <label className={`cursor-pointer rounded-lg border p-3 text-sm ${executor === "COLLECTOR" ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-ink-900"} ${collectors.length === 0 ? "opacity-50" : ""}`}>
            <input type="radio" name="executor" value="COLLECTOR" className="sr-only" checked={executor === "COLLECTOR"} onChange={() => setExecutor("COLLECTOR")} disabled={collectors.length === 0} />
            <div className="font-medium text-white">On-prem collector</div>
            <div className="mt-1 text-xs text-slate-400">
              {collectors.length === 0 ? "No collectors registered yet." : "For printers on an internal network."}
            </div>
          </label>
        </div>
        {executor === "COLLECTOR" && (
          <select name="collectorId" className="input mt-2" defaultValue={collectors[0]?.id}>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.online ? " (online)" : " (offline)"}</option>
            ))}
          </select>
        )}
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
