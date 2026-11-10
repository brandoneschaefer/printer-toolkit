// Scan execution + scheduling core.
//
// This module is intentionally FREE of "server-only" so the standalone worker
// process (worker/index.ts) can import and run it. It touches only the DB and
// the scan engine — never request-scoped helpers (sessions, cookies, tenant).

import { prisma } from "./db";
import { env } from "./env";
import { expandScope } from "./scanner/targets";
import { runScan, riskScore, severityCounts } from "./scanner";
import type { HostResult } from "./scanner";
import type { ScheduleCadence } from "@prisma/client";

/**
 * Persist scan results and mark an audit COMPLETED. Shared by the cloud runner
 * and the collector results endpoint, so both store data identically and the
 * risk score is always recomputed server-side from the findings.
 */
export async function persistResults(auditId: string, hosts: HostResult[]): Promise<void> {
  const allFindings = hosts.flatMap((h) => h.findings);
  const score = riskScore(allFindings);
  const counts = severityCounts(allFindings);

  await prisma.$transaction(async (tx) => {
    for (const h of hosts) {
      const createdHost = await tx.auditHost.create({
        data: {
          auditId,
          address: h.address,
          hostname: h.hostname,
          online: h.online,
          openPorts: h.openPorts,
          vendor: h.vendor,
        },
      });
      if (h.findings.length > 0) {
        await tx.finding.createMany({
          data: h.findings.map((f) => ({
            auditId,
            hostId: createdHost.id,
            host: f.host,
            port: f.port,
            protocol: f.protocol,
            checkId: f.checkId,
            title: f.title,
            severity: f.severity,
            description: f.description,
            evidence: f.evidence,
            recommendation: f.recommendation,
          })),
        });
      }
    }
    await tx.audit.update({
      where: { id: auditId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        riskScore: score,
        summary: {
          severity: counts,
          hosts: hosts.length,
          online: hosts.filter((h) => h.online).length,
          findings: allFindings.length,
        },
      },
    });
  });
}

export async function markAuditFailed(auditId: string, message: string): Promise<void> {
  await prisma.audit
    .update({ where: { id: auditId }, data: { status: "FAILED", completedAt: new Date(), error: message } })
    .catch(() => {});
}

/** Execute a CLOUD audit in-process and persist results. */
export async function runAuditJob(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) return;
  // Collector audits are executed by the agent, never here.
  if (audit.executor === "COLLECTOR") return;
  // Guard against double-execution.
  if (audit.status === "COMPLETED" || audit.status === "RUNNING") return;

  const scope = audit.scope as any;
  const targetValues: string[] = (scope?.targets ?? []).map((t: any) => t.value);
  const activeProbes: boolean = scope?.activeProbes ?? true;

  await prisma.audit.update({ where: { id: auditId }, data: { status: "RUNNING", startedAt: new Date() } });

  try {
    const { hosts } = expandScope(targetValues, env.scanner.maxHosts);
    const result = await runScan(hosts, { tcpTimeoutMs: env.scanner.tcpTimeoutMs, activeProbes });
    await persistResults(auditId, result.hosts);
  } catch (err) {
    await markAuditFailed(auditId, err instanceof Error ? err.message : "Unknown scan error");
  }
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export function computeNextRun(cadence: ScheduleCadence, from: Date = new Date()): Date {
  const next = new Date(from);
  if (cadence === "DAILY") next.setDate(next.getDate() + 1);
  else if (cadence === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (cadence === "MONTHLY") next.setMonth(next.getMonth() + 1);
  return next;
}

/** Local copy of the subscription check (tenant.ts is server-only). */
function subscriptionActive(status: string, currentPeriodEnd: Date | null): boolean {
  if (status !== "ACTIVE") return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

/**
 * Create a QUEUED audit from a schedule. Scheduled re-scans require an active
 * subscription (that is the subscription's value); if the subscription has
 * lapsed we skip the run and return null instead of consuming one-time credits.
 */
export async function createAuditFromSchedule(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || !schedule.enabled) return null;

  const org = await prisma.organization.findUnique({ where: { id: schedule.orgId } });
  if (!org) return null;
  if (!subscriptionActive(org.subscriptionStatus, org.currentPeriodEnd)) {
    // Subscription lapsed — don't run, but keep the schedule so it resumes on renewal.
    return null;
  }

  const targets = await prisma.target.findMany({
    where: { id: { in: schedule.targetIds }, orgId: schedule.orgId, authorized: true },
  });
  if (targets.length === 0) return null;

  // Validate the collector still exists for collector-mode schedules.
  let collectorId: string | null = null;
  if (schedule.executor === "COLLECTOR") {
    if (!schedule.collectorId) return null;
    const collector = await prisma.collector.findFirst({
      where: { id: schedule.collectorId, orgId: schedule.orgId },
    });
    if (!collector) return null;
    collectorId = collector.id;
  }

  const { hosts } = expandScope(targets.map((t) => t.value), env.scanner.maxHosts);
  if (hosts.length === 0) return null;

  const audit = await prisma.audit.create({
    data: {
      orgId: schedule.orgId,
      name: `${schedule.name} (scheduled ${new Date().toISOString().slice(0, 10)})`,
      kind: "SUBSCRIPTION",
      executor: schedule.executor,
      collectorId,
      status: "QUEUED",
      scope: {
        targets: targets.map((t) => ({ label: t.label, value: t.value })),
        hostCount: hosts.length,
        activeProbes: schedule.activeProbes,
        scheduleId: schedule.id,
      },
    },
  });
  return audit.id;
}
