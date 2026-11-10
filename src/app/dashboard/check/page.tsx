import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { DomainCheckForm } from "@/components/DomainCheckForm";
import { BulkCheckForm } from "@/components/BulkCheckForm";
import { StatusPill } from "@/components/SeverityBadge";
import { dateTime } from "@/lib/format";

export default async function OperatorCheckPage() {
  const { org } = await requireTenant();
  const bulks = await prisma.bulkCheck.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Exposure check</h1>
        <p className="text-sm text-slate-400">
          Research a prospect&apos;s external exposure by domain — no email, nothing logged. Great before a sales call.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Single domain <span className="text-xs font-normal text-slate-500">(deep check, uses Shodan)</span></h2>
        <DomainCheckForm />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Bulk check (CSV) <span className="text-xs font-normal text-slate-500">(background, free)</span></h2>
        <BulkCheckForm />
      </div>

      {bulks.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-white">Recent bulk checks</h2>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Exposed</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {bulks.map((b) => (
                  <tr key={b.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/check/bulk/${b.id}`} className="font-medium text-brand-300 hover:underline">
                        {b.name ?? "Bulk check"}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{b.processed}/{b.total}</td>
                    <td className="px-4 py-3 text-slate-300">{b.exposedCount}</td>
                    <td className="px-4 py-3 text-slate-400">{dateTime(b.createdAt)}</td>
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
