"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ShieldAlert, ShieldCheck, Search } from "lucide-react";
import { externalCheckAction, type CheckState } from "@/lib/actions/check";

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

      {r && (
        <div className="space-y-4">
          {/* Verdict */}
          {r.exposed ? (
            <div className="card border-red-400/30 bg-red-500/5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-red-400" />
                <h2 className="text-lg font-semibold text-red-300">External exposure detected on {r.domain}</h2>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                We found internet-facing services below. These are visible to anyone — attackers included.
              </p>
            </div>
          ) : (
            <div className="card border-emerald-400/30 bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <h2 className="text-lg font-semibold text-emerald-300">No obvious external exposure on {r.domain}</h2>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Good news from the outside. But most printer risk lives <strong>inside</strong> your network — invisible
                from here. An internal audit is the only way to see it.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Public IPs", r.ips.length],
              ["Subdomains found", r.subdomains.length],
              ["Printer-like hostnames", r.printerSubdomains.length],
            ].map(([label, val]) => (
              <div key={label as string} className="card text-center">
                <div className="text-2xl font-bold text-white">{val as number}</div>
                <div className="text-xs text-slate-400">{label as string}</div>
              </div>
            ))}
          </div>

          {/* Findings */}
          {r.findings.length > 0 && (
            <div className="space-y-2">
              {r.findings.map((f, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge sev-${f.severity}`}>{f.severity}</span>
                      <span className="font-medium text-white">{f.title}</span>
                    </div>
                    <span className="text-xs text-slate-500">{f.source}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{f.detail}</p>
                </div>
              ))}
            </div>
          )}

          {r.notes.map((n, i) => (
            <p key={i} className="text-xs text-slate-500">{n}</p>
          ))}

          {/* CTA */}
          <div className="card border-brand-400/40 ring-1 ring-brand-400/30">
            <h3 className="font-semibold text-white">See what this misses</h3>
            <p className="mt-1 text-sm text-slate-300">
              This external check only sees what&apos;s exposed to the internet. A full PRET audit assesses every printer
              on your internal network for default passwords, open management, and insecure protocols — the risks that
              never show up from outside.
            </p>
            <Link href="/register" className="btn-primary mt-4">Get a full audit</Link>
          </div>
        </div>
      )}
    </div>
  );
}
