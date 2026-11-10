// Bulk external-exposure check runner. Runs in the worker (or in-process
// fallback). DNS + certificate-transparency only — no Shodan — so it is free
// and safe to run over large lists. No "server-only": the worker imports it.

import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { externalCheck, SEVERITY_RANK } from "./recon";

const CONCURRENCY = 8;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function runBulkCheckJob(bulkId: string): Promise<void> {
  const bulk = await prisma.bulkCheck.findUnique({ where: { id: bulkId } });
  if (!bulk || bulk.status === "COMPLETED") return;

  await prisma.bulkCheck.update({ where: { id: bulkId }, data: { status: "RUNNING" } });

  try {
    const pending = await prisma.bulkCheckDomain.findMany({
      where: { bulkId, status: "pending" },
      select: { id: true, domain: true },
    });

    await mapLimit(pending, CONCURRENCY, async (d) => {
      // Shodan intentionally omitted for bulk (free DNS + cert-transparency only).
      const r = await externalCheck(d.domain, undefined);
      if (!r) {
        await prisma.bulkCheckDomain.update({ where: { id: d.id }, data: { status: "invalid" } });
      } else {
        r.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
        // Save a shareable standalone report for this domain.
        const token = randomBytes(12).toString("base64url");
        await prisma.exposureReport.create({
          data: { token, orgId: bulk.orgId, domain: r.domain, exposed: r.exposed, result: r as any },
        });
        await prisma.bulkCheckDomain.update({
          where: { id: d.id },
          data: {
            status: "done",
            exposed: r.exposed,
            ips: r.ips.length,
            subdomains: r.subdomains.length,
            findings: r.findings.length,
            top: r.findings[0]?.title ?? null,
            shareToken: token,
          },
        });
      }
      // Progress counters (best-effort; detail page polls).
      await prisma.bulkCheck.update({
        where: { id: bulkId },
        data: { processed: { increment: 1 }, ...(r?.exposed ? { exposedCount: { increment: 1 } } : {}) },
      });
    });

    await prisma.bulkCheck.update({
      where: { id: bulkId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (err) {
    await prisma.bulkCheck
      .update({ where: { id: bulkId }, data: { status: "FAILED", error: err instanceof Error ? err.message : "bulk check failed", completedAt: new Date() } })
      .catch(() => {});
  }
}
