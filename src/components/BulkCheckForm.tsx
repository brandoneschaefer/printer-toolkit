"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { createBulkCheckAction, type BulkCreateState } from "@/lib/actions/check";

const initial: BulkCreateState = {};

export function BulkCheckForm() {
  const [state, formAction, pending] = useActionState(createBulkCheckAction, initial);

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label className="label" htmlFor="bulk-name">Name (optional)</label>
        <input id="bulk-name" name="name" className="input" placeholder="Q4 prospect list" />
      </div>
      <div>
        <label className="label" htmlFor="file">Upload a CSV of domains</label>
        <input id="file" name="file" type="file" accept=".csv,.txt" className="input" />
        <p className="mt-1 text-xs text-slate-500">One domain per line (or comma-separated). A header row is fine — up to 5,000 domains.</p>
      </div>
      <div>
        <label className="label" htmlFor="domains">…or paste domains</label>
        <textarea id="domains" name="domains" className="input min-h-[90px]" placeholder={"acme.com\nnorthwind.com\ncontoso.com"} />
      </div>
      {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        <Upload className="h-4 w-4" /> {pending ? "Starting…" : "Start bulk check"}
      </button>
      <p className="text-xs text-slate-500">
        Runs in the background and is free — it uses internet-exposure data plus DNS and certificate transparency.
        You&apos;ll see results fill in live. Use the single-domain check above for a deeper lookup.
      </p>
    </form>
  );
}
