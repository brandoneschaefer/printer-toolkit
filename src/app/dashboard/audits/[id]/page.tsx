import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { FileDown } from "lucide-react";
import { SeverityBadge, StatusPill, RiskMeter } from "@/components/SeverityBadge";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HostTable } from "@/components/HostTable";
import { dateTime, relativeDuration } from "@/lib/format";
import { groupFindingsByHost, SEV_ORDER } from "@/lib/report";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireTenant();

  const audit = await prisma.audit.findFirst({
    where: { id, orgId: org.id },
    include: {
      hosts: { orderBy: { address: "asc" } },
      findings: true,
      collector: { select: { name: true } },
    },
  });
  if (!audit) notFound();

  const inFlight = audit.status === "QUEUED" || audit.status === "RUNNING";
  const summary = (audit.summary as any) ?? null;
  const counts: Record<string, number> =
    summary?.severity ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };

  const findingGroups = groupFindingsByHost(audit.findings);
  const deviceByHost = new Map(
    audit.hosts.map((h) => [
      h.address,
      [h.deviceType, h.vendor, h.model && h.model.toLowerCase() !== (h.vendor ?? "").toLowerCase() ? h.model : null]
        .filter(Boolean)
        .join(" · "),
    ])
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
            {audit.status === "COMPLETED" && (
              <Link href={`/report/${audit.id}`} target="_blank" className="btn-ghost text-sm">
                <FileDown className="h-4 w-4" /> Export PDF
              </Link>
            )}
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
            {audit.executor === "COLLECTOR" && audit.status === "QUEUED"
              ? `Waiting for collector “${audit.collector?.name ?? "—"}” to pick up this job. Make sure the collector is running on your network.`
              : `The scan is ${audit.status.toLowerCase()}. This page updates automatically as results arrive.`}
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

          {/* Findings grouped by host */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">Findings &amp; recommendations</h2>
            {findingGroups.length === 0 ? (
              <div className="card text-sm text-emerald-300">
                No exposures detected across the scanned scope. 🎉
              </div>
            ) : (
              <div className="space-y-6">
                {findingGroups.map((group) => (
                  <div key={group.host}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-200">{group.host}</span>
                      {deviceByHost.get(group.host) && (
                        <span className="badge bg-brand-500/15 text-brand-300">{deviceByHost.get(group.host)}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {group.findings.length} finding{group.findings.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.findings.map((f) => (
                        <div key={f.id} className="card">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <SeverityBadge severity={f.severity} />
                              <span className="font-semibold text-white">{f.title}</span>
                            </div>
                            <span className="font-mono text-xs text-slate-400">
                              {f.port ? `:${f.port}` : ""} {f.protocol ? `(${f.protocol})` : ""}
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hosts */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">Hosts</h2>
            <HostTable hosts={audit.hosts} />
          </div>
        </>
      )}
    </div>
  );
}
