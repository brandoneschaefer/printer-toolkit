import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";

export default async function LeadsPage() {
  await requireTenant();
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-sm text-slate-400">
          Companies that ran the free External Exposure Check. Follow up — especially the exposed ones.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="card text-sm text-slate-400">
          No leads yet. Share your exposure-check link: <code>/check</code>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono text-slate-200">{l.domain}</td>
                  <td className="px-4 py-3 text-slate-300">{l.email}</td>
                  <td className="px-4 py-3">
                    {l.exposed ? (
                      <span className="badge bg-red-500/20 text-red-300">Exposed</span>
                    ) : (
                      <span className="badge bg-emerald-500/20 text-emerald-300">Clean</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{dateTime(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
