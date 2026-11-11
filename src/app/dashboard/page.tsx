import Link from "next/link";
import { Crosshair, FileSearch, ShieldAlert, Plus } from "lucide-react";
import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { StatusPill } from "@/components/SeverityBadge";
import { dateTime } from "@/lib/format";
import { redirect } from "next/navigation";
import { SHOW_ONE_TIME_AUDIT, SIMPLE_MONITORING_MODE } from "@/lib/features";

export default async function OverviewPage() {
  if (SIMPLE_MONITORING_MODE) redirect("/dashboard/monitor");
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);

  const [targetCount, authorizedCount, auditCount, audits, lastCompleted] = await Promise.all([
    prisma.target.count({ where: { orgId: org.id } }),
    prisma.target.count({ where: { orgId: org.id, authorized: true } }),
    prisma.audit.count({ where: { orgId: org.id } }),
    prisma.audit.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.audit.findFirst({
      where: { orgId: org.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const canRun = subActive || org.auditCredits > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-slate-400">Security posture across your printer fleet.</p>
        </div>
        <Link href="/dashboard/audits/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New audit
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Crosshair className="h-5 w-5" />} label="Authorized targets" value={`${authorizedCount}/${targetCount}`} href="/dashboard/targets" />
        <Stat icon={<FileSearch className="h-5 w-5" />} label="Audits run" value={String(auditCount)} href="/dashboard/audits" />
        <Stat
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Latest risk score"
          value={lastCompleted ? String(lastCompleted.riskScore) : "—"}
          href={lastCompleted ? `/dashboard/audits/${lastCompleted.id}` : "/dashboard/audits"}
        />
      </div>

      {!canRun && (
        <div className="card border-amber-400/30 bg-amber-500/5">
          <h3 className="font-semibold text-amber-300">
            {SHOW_ONE_TIME_AUDIT ? "No audit credits" : "No active subscription"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {SHOW_ONE_TIME_AUDIT
              ? "Purchase a one-time audit or start a monitoring subscription to run assessments."
              : "Start a monitoring subscription to run assessments."}
          </p>
          <Link href="/dashboard/billing" className="btn-primary mt-4">Go to billing</Link>
        </div>
      )}

      {/* Recent audits */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent audits</h2>
          <Link href="/dashboard/audits" className="text-sm text-brand-300 hover:underline">View all</Link>
        </div>
        {audits.length === 0 ? (
          <div className="card text-sm text-slate-400">
            No audits yet. <Link href="/dashboard/audits/new" className="text-brand-300 hover:underline">Run your first audit →</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Audit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/audits/${a.id}`} className="font-medium text-brand-300 hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{a.status === "COMPLETED" ? a.riskScore : "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{dateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="card transition hover:border-brand-400/40">
      <div className="flex items-center gap-2 text-brand-300">{icon}<span className="text-xs uppercase tracking-wide text-slate-400">{label}</span></div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
    </Link>
  );
}
