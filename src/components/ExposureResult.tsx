import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReconResult } from "@/lib/recon";

export function ExposureResult({ result: r, showCta = true }: { result: ReconResult; showCta?: boolean }) {
  return (
    <div className="space-y-4">
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
            Good news from the outside. But most printer risk lives <strong>inside</strong> the network — invisible
            from here. An internal audit is the only way to see it.
          </p>
        </div>
      )}

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

      {r.ips.length > 0 && (
        <p className="text-xs text-slate-500">Public IPs: <span className="font-mono">{r.ips.join(", ")}</span></p>
      )}
      {r.notes.map((n, i) => (
        <p key={i} className="text-xs text-slate-500">{n}</p>
      ))}

      {showCta && (
        <div className="card border-brand-400/40 ring-1 ring-brand-400/30">
          <h3 className="font-semibold text-white">See what this misses</h3>
          <p className="mt-1 text-sm text-slate-300">
            This external check only sees what&apos;s exposed to the internet. A full PRET audit assesses every printer
            on the internal network for default passwords, open management, and insecure protocols.
          </p>
          <Link href="/register" className="btn-primary mt-4">Get a full audit</Link>
        </div>
      )}
    </div>
  );
}
