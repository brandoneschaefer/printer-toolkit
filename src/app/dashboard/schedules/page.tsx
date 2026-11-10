import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { CreateScheduleForm } from "@/components/CreateScheduleForm";
import { toggleScheduleAction, deleteScheduleAction, runScheduleNowAction } from "@/lib/actions/schedules";
import { dateTime } from "@/lib/format";
import { Trash2, Play, Pause, CalendarClock } from "lucide-react";

const CADENCE_LABEL: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };

export default async function SchedulesPage() {
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);

  const [targets, collectorRows, schedules] = await Promise.all([
    prisma.target.findMany({
      where: { orgId: org.id, authorized: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, value: true },
    }),
    prisma.collector.findMany({ where: { orgId: org.id }, select: { id: true, name: true } }),
    prisma.schedule.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" } }),
  ]);

  // Map target ids -> labels for display.
  const allTargets = await prisma.target.findMany({
    where: { orgId: org.id },
    select: { id: true, label: true },
  });
  const labelOf = new Map(allTargets.map((t) => [t.id, t.label]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Scheduled re-scans</h1>
        <p className="text-sm text-slate-400">
          Automatically re-audit your fleet on a recurring cadence. Part of continuous monitoring.
        </p>
      </div>

      <CreateScheduleForm targets={targets} collectors={collectorRows} subscriptionActive={subActive} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Your schedules ({schedules.length})</h2>
        {schedules.length === 0 ? (
          <div className="card text-sm text-slate-400">No schedules yet.</div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-brand-300" />
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="badge bg-brand-500/15 text-brand-300">{CADENCE_LABEL[s.cadence]}</span>
                    {s.enabled ? (
                      <span className="badge bg-emerald-500/20 text-emerald-300">Enabled</span>
                    ) : (
                      <span className="badge bg-slate-500/20 text-slate-400">Paused</span>
                    )}
                    <span className="badge bg-slate-500/20 text-slate-300">{s.executor === "COLLECTOR" ? "Collector" : "Cloud"}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {s.targetIds.map((id) => labelOf.get(id) ?? "—").join(", ")}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Next run {dateTime(s.nextRunAt)} · Last run {s.lastRunAt ? dateTime(s.lastRunAt) : "never"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={runScheduleNowAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-ghost text-xs" type="submit" title="Run now"><Play className="h-4 w-4" /> Run now</button>
                  </form>
                  <form action={toggleScheduleAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-ghost text-xs" type="submit">
                      {s.enabled ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Resume</>}
                    </button>
                  </form>
                  <form action={deleteScheduleAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-ghost text-xs text-red-300 hover:bg-red-500/10" type="submit"><Trash2 className="h-4 w-4" /></button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
