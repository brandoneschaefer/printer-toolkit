"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createScheduleAction, type ScheduleActionState } from "@/lib/actions/schedules";

const initial: ScheduleActionState = {};

interface TargetOption { id: string; label: string; value: string }
interface CollectorOption { id: string; name: string }

export function CreateScheduleForm({
  targets,
  collectors,
  subscriptionActive,
}: {
  targets: TargetOption[];
  collectors: CollectorOption[];
  subscriptionActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(createScheduleAction, initial);
  const [executor, setExecutor] = useState<"CLOUD" | "COLLECTOR">("CLOUD");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-5">
      <h2 className="font-semibold text-white">Create a re-scan schedule</h2>

      {!subscriptionActive && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Scheduled re-scans run only while your monitoring subscription is active. You can create a schedule now; it
          will begin firing once you subscribe.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Schedule name</label>
          <input id="name" name="name" className="input" placeholder="Weekly HQ sweep" required />
        </div>
        <div>
          <label className="label" htmlFor="cadence">Cadence</label>
          <select id="cadence" name="cadence" className="input" defaultValue="WEEKLY">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
      </div>

      <div>
        <span className="label">Targets</span>
        {targets.length === 0 ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            No authorized targets. Add and authorize targets first.
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

      <div>
        <span className="label">Execution</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-lg border p-3 text-sm ${executor === "CLOUD" ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-ink-900"}`}>
            <input type="radio" name="executor" value="CLOUD" className="sr-only" checked={executor === "CLOUD"} onChange={() => setExecutor("CLOUD")} />
            <div className="font-medium text-white">Cloud scan</div>
          </label>
          <label className={`cursor-pointer rounded-lg border p-3 text-sm ${executor === "COLLECTOR" ? "border-brand-400 bg-brand-500/10" : "border-white/10 bg-ink-900"} ${collectors.length === 0 ? "opacity-50" : ""}`}>
            <input type="radio" name="executor" value="COLLECTOR" className="sr-only" checked={executor === "COLLECTOR"} onChange={() => setExecutor("COLLECTOR")} disabled={collectors.length === 0} />
            <div className="font-medium text-white">On-prem collector</div>
          </label>
        </div>
        {executor === "COLLECTOR" && (
          <select name="collectorId" className="input mt-2" defaultValue={collectors[0]?.id}>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input type="checkbox" name="activeProbes" value="on" defaultChecked className="h-4 w-4 accent-brand-500" />
        Enable active (read-only) probes: PJL, SNMP, default-credential checks.
      </label>

      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">Schedule created.</p>}

      <button type="submit" className="btn-primary" disabled={pending || targets.length === 0}>
        {pending ? "Creating…" : "Create schedule"}
      </button>
    </form>
  );
}
