import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { PrintButton } from "@/components/PrintButton";
import { groupFindingsByHost, SEV_ORDER } from "@/lib/report";
import { dateTime } from "@/lib/format";

function RiskLabel(score: number) {
  if (score >= 70) return "Critical";
  if (score >= 40) return "Elevated";
  if (score >= 15) return "Moderate";
  return "Low";
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireTenant();

  const audit = await prisma.audit.findFirst({
    where: { id, orgId: org.id },
    include: { hosts: { orderBy: { address: "asc" } }, findings: true, collector: { select: { name: true } } },
  });
  if (!audit) notFound();

  const [authorization] = await Promise.all([
    prisma.authorization.findFirst({ where: { orgId: org.id, active: true }, orderBy: { signedAt: "desc" } }),
  ]);

  const summary = (audit.summary as any) ?? null;
  const counts: Record<string, number> = summary?.severity ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const groups = groupFindingsByHost(audit.findings);
  const responding = audit.hosts.filter((h) => h.online);
  const deviceByHost = new Map(
    audit.hosts.map((h) => [
      h.address,
      [h.deviceType, h.vendor, h.model && h.model.toLowerCase() !== (h.vendor ?? "").toLowerCase() ? h.model : null]
        .filter(Boolean)
        .join(" · "),
    ])
  );

  return (
    <div className="min-h-screen bg-slate-100 py-8 text-slate-900">
      <div className="print-page mx-auto max-w-3xl rounded-lg bg-white p-10 shadow-xl">
        {/* Action bar (screen only) */}
        <div className="no-print mb-6 flex items-center justify-between">
          <a href={`/dashboard/audits/${audit.id}`} className="text-sm text-brand-600 hover:underline">← Back to dashboard</a>
          <PrintButton auto />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-white">🛡</span>
              PRET
            </div>
            <div className="mt-1 text-sm text-slate-500">Printer Security Assessment Report</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-slate-900">{audit.name}</div>
            <div className="text-slate-500">{dateTime(audit.completedAt ?? audit.createdAt)}</div>
            <div className="text-slate-400">{audit.executor === "COLLECTOR" ? `Collector: ${audit.collector?.name ?? "—"}` : "Cloud scan"}</div>
          </div>
        </div>

        {/* Prepared for + authorization */}
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assessment</div>
            <div className="mt-1 font-medium text-slate-900">{audit.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Authorization</div>
            {authorization ? (
              <div className="mt-1 text-slate-700">
                {authorization.signerName}{authorization.signerTitle ? `, ${authorization.signerTitle}` : ""}<br />
                <span className="text-slate-500">{authorization.signerEmail} · signed {dateTime(authorization.signedAt)}</span>
              </div>
            ) : (
              <div className="mt-1 text-slate-400">Not on file</div>
            )}
          </div>
          {authorization?.scope && (
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Authorized scope</div>
              <div className="mt-1 text-slate-700">{authorization.scope}</div>
            </div>
          )}
        </div>

        {/* Executive summary */}
        <div className="avoid-break mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall risk</div>
              <div className="text-4xl font-bold text-slate-900">{audit.riskScore}<span className="text-base font-normal text-slate-500"> / 100</span></div>
              <div className="text-sm text-slate-500">{RiskLabel(audit.riskScore)} risk</div>
            </div>
            <div className="flex gap-2">
              {SEV_ORDER.map((s) => (
                <div key={s} className="text-center">
                  <div className="text-lg font-bold text-slate-900">{counts[s] ?? 0}</div>
                  <span className={`badge rsev-${s} text-[10px]`}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {responding.length} of {audit.hosts.length} scanned addresses responded. {audit.findings.length} finding
            {audit.findings.length === 1 ? "" : "s"} across {groups.length} host{groups.length === 1 ? "" : "s"}.
            All checks were non-destructive and read-only.
          </p>
        </div>

        {/* Findings by host */}
        <h2 className="mt-8 text-lg font-bold text-slate-900">Findings &amp; recommendations</h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">No exposures detected across the scanned scope.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {groups.map((group) => (
              <div key={group.host} className="avoid-break">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-800">{group.host}</span>
                  {deviceByHost.get(group.host) && (
                    <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                      {deviceByHost.get(group.host)}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {group.findings.map((f) => (
                    <div key={f.id} className="avoid-break rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge rsev-${f.severity}`}>{f.severity}</span>
                          <span className="font-semibold text-slate-900">{f.title}</span>
                        </div>
                        <span className="font-mono text-xs text-slate-400">{f.port ? `:${f.port}` : ""} {f.protocol ?? ""}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{f.description}</p>
                      {f.evidence && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">{f.evidence}</pre>
                      )}
                      <div className="mt-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Recommendation</span>
                        <p className="mt-1 text-slate-700">{f.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Host appendix */}
        <h2 className="mt-8 text-lg font-bold text-slate-900">Responding hosts</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
            <tr><th className="py-2">Address</th><th className="py-2">Device</th><th className="py-2">Open ports</th></tr>
          </thead>
          <tbody>
            {responding.map((h) => (
              <tr key={h.id} className="border-b border-slate-100">
                <td className="py-2 font-mono text-slate-800">{h.address}</td>
                <td className="py-2 text-slate-600">{deviceByHost.get(h.address) || "—"}</td>
                <td className="py-2 font-mono text-slate-500">{h.openPorts.length ? h.openPorts.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          Generated by PRET (Printer Exploitation Toolkit) on {dateTime(new Date())}. Confidential — do not distribute.
          Assessment was authorized, non-destructive, and limited to targets attested as authorized by the customer.
        </div>
      </div>
    </div>
  );
}
