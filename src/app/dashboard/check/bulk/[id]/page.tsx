import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ExportBulkButton } from "@/components/ExportBulkButton";
import { StatusPill } from "@/components/SeverityBadge";
import { dateTime } from "@/lib/format";

export default async function BulkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireTenant();

  const bulk = await prisma.bulkCheck.findFirst({ where: { id, orgId: org.id } });
  if (!bulk) notFound();

  const inFlight = bulk.status === "QUEUED" || bulk.status === "RUNNING";

  // Show processed rows, exposed first. Cap the DOM for very large runs.
  const rows = await prisma.bulkCheckDomain.findMany({
    where: { bulkId: bulk.id, status: { not: "pending" } },
    orderBy: [{ exposed: "desc" }, { findings: "desc" }, { domain: "asc" }],
    take: 1000,
  });
  const pct = bulk.total ? Math.round((bulk.processed / bulk.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/check" className="text-sm text-brand-300 hover:underline">← Back to exposure check</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">{bulk.name ?? "Bulk exposure check"}</h1>
          <div className="flex items-center gap-3">
            <StatusPill status={bulk.status} />
            {inFlight && <AutoRefresh />}
            {rows.length > 0 && <ExportBulkButton rows={rows} filename="bulk-exposure-results.csv" />}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Created {dateTime(bulk.createdAt)} · DNS + certificate-transparency scan (no Shodan)
        </p>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">{bulk.processed} / {bulk.total} domains checked</span>
          <span className="font-semibold text-red-300">{bulk.exposedCount} exposed</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-brand-500" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        {bulk.status === "FAILED" && <p className="mt-3 text-sm text-red-300">{bulk.error ?? "This bulk check failed."}</p>}
      </div>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="card text-sm text-slate-400">
          {inFlight ? "Checking domains… results will appear here as they complete." : "No results."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">IPs</th>
                <th className="px-4 py-3">Subdomains</th>
                <th className="px-4 py-3">Findings</th>
                <th className="px-4 py-3">Top finding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono text-slate-200">{r.domain}</td>
                  <td className="px-4 py-3">
                    {r.status === "invalid" ? (
                      <span className="badge bg-slate-500/20 text-slate-400">Invalid</span>
                    ) : r.exposed ? (
                      <span className="badge bg-red-500/20 text-red-300">Exposed</span>
                    ) : (
                      <span className="badge bg-emerald-500/20 text-emerald-300">Clean</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.ips}</td>
                  <td className="px-4 py-3 text-slate-300">{r.subdomains}</td>
                  <td className="px-4 py-3 text-slate-300">{r.findings}</td>
                  <td className="px-4 py-3 text-slate-400">{r.top ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 1000 && (
            <div className="border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
              Showing the first 1,000 results (exposed first). Export covers these rows.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
