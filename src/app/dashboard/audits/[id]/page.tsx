import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { SeverityBadge, StatusPill, RiskMeter } from "@/components/SeverityBadge";
import { AutoRefresh } from "@/components/AutoRefresh";
import { dateTime, relativeDuration } from "@/lib/format";

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireTenant();

  const audit = await prisma.audit.findFirst({
    where: { id, orgId: org.id },
    include: {
      hosts: { orderBy: { address: "asc" } },
      findings: true,
    },
  });
  if (!audit) notFound();

  const inFlight = audit.status === "QUEUED" || audit.status === "RUNNING";
  const summary = (audit.summary as any) ?? null;
  const counts: Record<string, number> =
    summary?.severity ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };

  const sortedFindings = [...audit.findings].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity as any) - SEV_ORDER.indexOf(b.severity as any)
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/audits" className="text-sm text-brand-300 hover:underline">← Back to audits</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">{audit.name}</h1>
          <div className="flex items-center gap-3">
            <StatusPill status={audit.status} />
            {inFlight && <AutoRefresh />}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {audit.kind === "SUBSCRIPTION" ? "Subscription audit" : "One-time audit"} · Created {dateTime(audit.createdAt)}
          {audit.completedAt && ` · Duration ${relativeDuration(audit.startedAt, audit.completedAt)}`}
        </p>
      </div>

      {audit.status === "FAILED" && (
        <div className="card border-red-400/30 bg-red-500/5">
          <h3 className="font-semibold text-red-300">Audit failed</h3>
          <p className="mt-1 text-sm text-slate-300">{audit.error ?? "Unknown error."}</p>
        </div>
      )}

      {inFlight && (
        <div className="card">
          <p className="text-sm text-slate-300">
            The scan is {audit.status.toLowerCase()}. This page updates automatically as results arrive.
          </p>
        </div>
      )}

      {audit.status === "COMPLETED" && (
        <>
          {/* Risk + severity summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card md:col-span-1">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Risk score</h3>
              <RiskMeter score={audit.riskScore} />
            </div>
            <div className="card md:col-span-2">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Findings by severity</h3>
              <div className="grid grid-cols-5 gap-2">
                {SEV_ORDER.map((s) => (
                  <div key={s} className="rounded-lg border border-white/10 bg-ink-900 p-3 text-center">
                    <div className="text-2xl font-bold text-white">{counts[s] ?? 0}</div>
                    <div className="mt-1"><SeverityBadge severity={s} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-400">
                {summary?.online ?? audit.hosts.filter((h) => h.online).length} of {audit.hosts.length} hosts responded ·{" "}
                {audit.findings.length} findings total
              </p>
            </div>
          </div>

          {/* Hosts */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">Hosts</h2>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Open ports</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.hosts.map((h) => (
                    <tr key={h.id} className="border-t border-white/5">
                      <td className="px-4 py-3 font-mono text-slate-200">{h.address}</td>
                      <td className="px-4 py-3">
                        {h.online ? (
                          <span className="badge bg-emerald-500/20 text-emerald-300">Online</span>
                        ) : (
                          <span className="badge bg-slate-500/20 text-slate-400">No response</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{h.vendor ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {h.openPorts.length ? h.openPorts.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Findings */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">Findings &amp; recommendations</h2>
            {sortedFindings.length === 0 ? (
              <div className="card text-sm text-emerald-300">
                No exposures detected across the scanned scope. 🎉
              </div>
            ) : (
              <div className="space-y-3">
                {sortedFindings.map((f) => (
                  <div key={f.id} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <SeverityBadge severity={f.severity} />
                        <span className="font-semibold text-white">{f.title}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        {f.host}{f.port ? `:${f.port}` : ""} {f.protocol ? `(${f.protocol})` : ""}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{f.description}</p>
                    {f.evidence && (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-ink-900 p-3 text-xs text-slate-400">
                        {f.evidence}
                      </pre>
                    )}
                    <div className="mt-3 rounded-lg border border-brand-400/20 bg-brand-500/5 p-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-300">Recommendation</span>
                      <p className="mt-1 text-sm text-slate-200">{f.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
