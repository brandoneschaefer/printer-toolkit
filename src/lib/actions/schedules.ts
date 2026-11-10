"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { scheduleSchema } from "@/lib/validation";
import { computeNextRun } from "@/lib/audit-core";

export interface ScheduleActionState {
  ok?: boolean;
  error?: string;
}

export async function createScheduleAction(
  _prev: ScheduleActionState,
  formData: FormData
): Promise<ScheduleActionState> {
  const { session, org } = await requireTenant();

  const parsed = scheduleSchema.safeParse({
    name: formData.get("name"),
    targetIds: formData.getAll("targetIds").map(String).filter(Boolean),
    cadence: formData.get("cadence"),
    activeProbes: formData.get("activeProbes") !== "off",
    executor: formData.get("executor") === "COLLECTOR" ? "COLLECTOR" : "CLOUD",
    collectorId: formData.get("collectorId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Verify targets are authorized and belong to the tenant.
  const targets = await prisma.target.findMany({
    where: { id: { in: parsed.data.targetIds }, orgId: org.id, authorized: true },
    select: { id: true },
  });
  if (targets.length === 0) return { error: "Select at least one authorized target." };

  if (parsed.data.executor === "COLLECTOR") {
    if (!parsed.data.collectorId) return { error: "Select a collector for collector-mode schedules." };
    const collector = await prisma.collector.findFirst({
      where: { id: parsed.data.collectorId, orgId: org.id },
    });
    if (!collector) return { error: "Collector not found." };
  }

  await prisma.schedule.create({
    data: {
      orgId: org.id,
      createdById: session.userId,
      name: parsed.data.name,
      targetIds: targets.map((t) => t.id),
      cadence: parsed.data.cadence,
      activeProbes: parsed.data.activeProbes,
      executor: parsed.data.executor,
      collectorId: parsed.data.executor === "COLLECTOR" ? parsed.data.collectorId || null : null,
      enabled: true,
      // First run on the next cadence boundary from now.
      nextRunAt: computeNextRun(parsed.data.cadence),
    },
  });

  revalidatePath("/dashboard/schedules");
  return { ok: true };
}

export async function toggleScheduleAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  const schedule = await prisma.schedule.findFirst({ where: { id, orgId: org.id } });
  if (schedule) {
    await prisma.schedule.update({ where: { id }, data: { enabled: !schedule.enabled } });
  }
  revalidatePath("/dashboard/schedules");
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  await prisma.schedule.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/dashboard/schedules");
}

/** Run a schedule immediately (manual trigger), independent of its cadence. */
export async function runScheduleNowAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  const schedule = await prisma.schedule.findFirst({ where: { id, orgId: org.id } });
  if (!schedule) return;
  // Dynamically import worker-side helpers (kept out of the server-only graph).
  const { createAuditFromSchedule } = await import("@/lib/audit-core");
  const { enqueueScan } = await import("@/lib/queue");
  const auditId = await createAuditFromSchedule(schedule.id);
  if (auditId) await enqueueScan(auditId);
  revalidatePath("/dashboard/schedules");
  revalidatePath("/dashboard/audits");
}
