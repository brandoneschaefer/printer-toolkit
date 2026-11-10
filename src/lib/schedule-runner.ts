// Scheduled re-scan processor. Called on a timer by the worker. Finds due
// schedules, creates an audit for each, dispatches it, and advances nextRunAt.
// No "server-only": runs inside the worker process.

import { prisma } from "./db";
import { createAuditFromSchedule, computeNextRun } from "./audit-core";
import { enqueueScan } from "./queue";

export interface TickResult {
  due: number;
  dispatched: number;
  skipped: number;
}

export async function processDueSchedules(now: Date = new Date()): Promise<TickResult> {
  const due = await prisma.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 100,
  });

  let dispatched = 0;
  let skipped = 0;

  for (const schedule of due) {
    // Advance nextRunAt FIRST so a slow/failed run can't cause a tight re-fire loop.
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt: computeNextRun(schedule.cadence, now) },
    });

    try {
      const auditId = await createAuditFromSchedule(schedule.id);
      if (auditId) {
        await enqueueScan(auditId);
        dispatched++;
      } else {
        // Subscription lapsed, no authorized targets, or missing collector.
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { due: due.length, dispatched, skipped };
}
