// Audit lifecycle: entitlement check -> create record -> run scan -> persist.

import "server-only";
import { prisma } from "./db";
import { env } from "./env";
import { expandScope } from "./scanner/targets";
import { runScan, riskScore, severityCounts } from "./scanner";
import { hasActiveSubscription } from "./tenant";
import type { AuditKind, ScanExecutor } from "@prisma/client";
import type { HostResult } from "./scanner";

export class EntitlementError extends Error {}
export class ScopeError extends Error {}

interface CreateAuditInput {
  orgId: string;
  userId: string;
  name: string;
  targetIds: string[];
  activeProbes: boolean;
  executor: ScanExecutor;
  collectorId?: string | null;
}

/**
 * Validate scope + entitlement and create a QUEUED audit, consuming a credit
 * if the org has no active subscription. Returns the audit id. Does NOT run
 * the scan (call runAuditJob for that).
 */
export async function createAudit(input: CreateAuditInput): Promise<string> {
  const org = await prisma.organization.findUnique({ where: { id: input.orgId } });
  if (!org) throw new Error("Organization not found");

  // Resolve authorized targets belonging to this tenant.
  const targets = await prisma.target.findMany({
    where: { id: { in: input.targetIds }, orgId: input.orgId },
  });
  if (targets.length === 0) throw new ScopeError("No valid targets selected.");
  const unauthorized = targets.filter((t) => !t.authorized);
  if (unauthorized.length > 0) {
    throw new ScopeError(
      `These targets are not marked as authorized: ${unauthorized.map((t) => t.label).join(", ")}. ` +
        "You may only audit systems you own or are explicitly authorized to test."
    );
  }

  const { hosts, errors } = expandScope(targets.map((t) => t.value), env.scanner.maxHosts);
  if (hosts.length === 0) {
    throw new ScopeError(errors.join("; ") || "Scope expanded to zero hosts.");
  }

  // When a collector is requested, verify it belongs to this tenant.
  if (input.executor === "COLLECTOR") {
    if (!input.collectorId) throw new ScopeError("Select a collector to run this audit.");
    const collector = await prisma.collector.findFirst({
      where: { id: input.collectorId, orgId: input.orgId },
    });
    if (!collector) throw new ScopeError("Selected collector was not found for this organization.");
  }

  // Entitlement: subscription covers unlimited audits; otherwise consume a credit.
  const subActive = hasActiveSubscription({
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd,
  } as any);

  let kind: AuditKind;
  if (subActive) {
    kind = "SUBSCRIPTION";
  } else if (org.auditCredits > 0) {
    kind = "ONE_TIME";
  } else {
    throw new EntitlementError(
      "No audit credits remaining and no active subscription. Purchase an audit or start a subscription to continue."
    );
  }

  // Create the audit and atomically consume a credit for one-time runs.
  const audit = await prisma.$transaction(async (tx) => {
    if (kind === "ONE_TIME") {
      const dec = await tx.organization.updateMany({
        where: { id: org.id, auditCredits: { gt: 0 } },
        data: { auditCredits: { decrement: 1 } },
      });
      if (dec.count === 0) {
        throw new EntitlementError("Audit credit was consumed by a concurrent request. Please try again.");
      }
    }
    return tx.audit.create({
      data: {
        orgId: org.id,
        createdById: input.userId,
        name: input.name,
        kind,
        executor: input.executor,
        collectorId: input.executor === "COLLECTOR" ? input.collectorId : null,
        status: "QUEUED",
        scope: {
          targets: targets.map((t) => ({ label: t.label, value: t.value })),
          hostCount: hosts.length,
          activeProbes: input.activeProbes,
        },
      },
    });
  });

  return audit.id;
}

/**
 * Persist scan results and mark an audit COMPLETED. Shared by the in-process
 * cloud runner and the collector results endpoint, so both paths store data
 * identically and the risk score is always recomputed server-side from the
 * findings (never trusted from the client).
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
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "FAILED", completedAt: new Date(), error: message },
  });
}

/** Execute a CLOUD audit in-process and persist results. */
export async function runAuditJob(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) return;
  const scope = audit.scope as any;
  const targetValues: string[] = (scope?.targets ?? []).map((t: any) => t.value);
  const activeProbes: boolean = scope?.activeProbes ?? true;

  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const { hosts } = expandScope(targetValues, env.scanner.maxHosts);
    const result = await runScan(hosts, { tcpTimeoutMs: env.scanner.tcpTimeoutMs, activeProbes });
    await persistResults(auditId, result.hosts);
  } catch (err) {
    await markAuditFailed(auditId, err instanceof Error ? err.message : "Unknown scan error");
  }
}
