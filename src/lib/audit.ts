// Audit creation + entitlement (server-side only). Execution lives in
// ./audit-core so the standalone worker can run scans without the Next server
// stack. These re-exports keep existing imports from "@/lib/audit" working.

import "server-only";
import { prisma } from "./db";
import { env } from "./env";
import { expandScope } from "./scanner/targets";
import { hasActiveSubscription } from "./tenant";
import type { AuditKind, ScanExecutor } from "@prisma/client";

export { persistResults, markAuditFailed, runAuditJob } from "./audit-core";

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
