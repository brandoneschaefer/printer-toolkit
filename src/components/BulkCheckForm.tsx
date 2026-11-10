"use client";

import { useActionState } from "react";
import { Upload, Download } from "lucide-react";
import { bulkCheckAction, type BulkState } from "@/lib/actions/check";

const initial: BulkState = {};

export function BulkCheckForm() {
  const [state, formAction, pending] = useActionState(bulkCheckAction, initial);
  const rows = state.rows ?? [];

  const downloadCsv = () => {
    const header = "domain,status,public_ips,findings,top_finding\n";
    const body = rows
      .map((r) => `${r.domain},${r.exposed ? "exposed" : "clean"},${r.ips},${r.findings},"${(r.top ?? "").replace(/"/g, "'")}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exposure-check-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <form action={formAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="file">Upload a CSV of domains</label>
          <input id="file" name="file" type="file" accept=".csv,.txt" className="input" />
          <p className="mt-1 text-xs text-slate-500">One domain per line (or comma-separated). A header row is fine — up to 50 domains per run.</p>
        </div>
        <div>
          <label className="label" htmlFor="domains">…or paste domains</label>
          <textarea id="domains" name="domains" className="input min-h-[90px]" placeholder={"acme.com\nnorthwind.com\ncontoso.com"} />
        </div>
        {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
        <button type="submit" className="btn-primary" disabled={pending}>
          <Upload className="h-4 w-4" /> {pending ? "Checking domains…" : "Run bulk check"}
        </button>
      </form>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Results ({rows.length}){state.skipped ? <span className="text-sm text-slate-400"> · {state.skipped} over the 50-domain limit skipped</span> : null}
            </h2>
            <button type="button" onClick={downloadCsv} className="btn-ghost text-xs"><Download className="h-4 w-4" /> Export CSV</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Public IPs</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Top finding</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.domain} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-slate-200">{r.domain}</td>
                    <td className="px-4 py-3">
                      {r.exposed ? (
                        <span className="badge bg-red-500/20 text-red-300">Exposed</span>
                      ) : (
                        <span className="badge bg-emerald-500/20 text-emerald-300">Clean</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.ips}</td>
                    <td className="px-4 py-3 text-slate-300">{r.findings}</td>
                    <td className="px-4 py-3 text-slate-400">{r.top ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
