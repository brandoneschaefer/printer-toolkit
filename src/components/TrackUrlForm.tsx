"use client";

import { useActionState } from "react";
import { trackUrlAction, type TrackActionState } from "@/lib/actions/monitor";

const initial: TrackActionState = {};

export function TrackUrlForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(trackUrlAction, initial);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="url">URL or domain to monitor</label>
        <input
          id="url"
          name="url"
          className="input"
          placeholder="example.com or https://printers.example.com"
          autoComplete="off"
          required
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-slate-500">We scan the host behind this URL weekly for printer exposures.</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" name="authorized" className="mt-1" disabled={disabled} />
        <span>I confirm I own, or am authorized to monitor, this URL for security assessment.</span>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
          Now monitoring {state.host} — weekly scans scheduled.
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending || disabled}>
        {pending ? "Adding…" : "Track URL"}
      </button>
    </form>
  );
}
