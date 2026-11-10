import Link from "next/link";
import { Plus } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { StatusPill } from "@/components/SeverityBadge";
import { dateTime } from "@/lib/format";

export default async function AuditsPage() {
  const { org } = await requireTenant();
  const audits = await prisma.audit.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { findings: true, hosts: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audits</h1>
          <p className="text-sm text-slate-400">All assessments run by your organization.</p>
        </div>
        <Link href="/dashboard/audits/new" className="btn-primary"><Plus className="h-4 w-4" /> New audit</Link>
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
                <th className="px-4 py-3">Hosts</th>
                <th className="px-4 py-3">Findings</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Type</th>
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
                  <td className="px-4 py-3 text-slate-300">{a._count.hosts}</td>
                  <td className="px-4 py-3 text-slate-300">{a._count.findings}</td>
                  <td className="px-4 py-3 text-slate-300">{a.status === "COMPLETED" ? a.riskScore : "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{a.kind === "SUBSCRIPTION" ? "Subscription" : "One-time"}</td>
                  <td className="px-4 py-3 text-slate-400">{dateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
