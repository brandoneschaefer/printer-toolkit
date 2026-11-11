import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import type { Severity } from "@prisma/client";

const SEV_CLASS: Record<Severity, string> = {
  CRITICAL: "bg-red-500/20 text-red-300",
  HIGH: "bg-orange-500/20 text-orange-300",
  MEDIUM: "bg-amber-500/20 text-amber-300",
  LOW: "bg-slate-500/20 text-slate-300",
  INFO: "bg-slate-500/20 text-slate-400",
};

export default async function AlertsPage() {
  const { org } = await requireTenant();

  // Alerts mirror the email threshold: MEDIUM and above, newest first.
  const findings = await prisma.finding.findMany({
    where: { audit: { orgId: org.id }, severity: { in: ["MEDIUM", "HIGH", "CRITICAL"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-sm text-slate-400">
          New printer-security exposures found by your weekly monitoring. We also email these to your team.
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="card text-sm text-slate-400">
          No alerts yet. When a weekly scan finds an exposure on one of your tracked URLs, it&apos;ll appear
          here — and land in your inbox.
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <div key={f.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`badge ${SEV_CLASS[f.severity]}`}>{f.severity}</span>
                  <span className="font-semibold text-white">{f.title}</span>
                </div>
                <span className="text-xs text-slate-500">{dateTime(f.createdAt)}</span>
              </div>
              <div className="mt-2 text-sm text-slate-300">
                <span className="text-slate-400">Host:</span> {f.host}
                {f.port ? <span className="text-slate-500"> · port {f.port}</span> : null}
                {f.protocol ? <span className="text-slate-500"> · {f.protocol}</span> : null}
              </div>
              <p className="mt-2 text-sm text-slate-400">{f.description}</p>
              <p className="mt-2 text-sm text-brand-300">→ {f.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
