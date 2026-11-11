import Link from "next/link";
import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { TrackUrlForm } from "@/components/TrackUrlForm";
import { untrackUrlAction } from "@/lib/actions/monitor";

export default async function MonitorPage() {
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);

  const targets = await prisma.target.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Tracked URLs</h1>
        <p className="text-sm text-slate-400">
          Add a URL and we monitor it every week, alerting you to new printer-security exposures.
        </p>
      </div>

      {!subActive && (
        <div className="card border-amber-400/30 bg-amber-500/5">
          <h3 className="font-semibold text-amber-300">Monitoring is paused</h3>
          <p className="mt-1 text-sm text-slate-300">
            Start your subscription to activate weekly scans on your tracked URLs.
          </p>
          <Link href="/dashboard/billing" className="btn-primary mt-4">Start monitoring</Link>
        </div>
      )}

      <TrackUrlForm />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          Monitoring {targets.length > 0 && <span className="text-slate-500">({targets.length})</span>}
        </h2>
        {targets.length === 0 ? (
          <div className="card text-sm text-slate-400">No URLs yet. Add one above to start monitoring.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Cadence</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-slate-100">{t.value}</td>
                    <td className="px-4 py-3 text-slate-400">Weekly</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${subActive ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {subActive ? "Monitoring" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={untrackUrlAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-xs text-slate-400 hover:text-red-300">Remove</button>
                      </form>
                    </td>
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
