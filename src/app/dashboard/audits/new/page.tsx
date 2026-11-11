import Link from "next/link";
import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { RunAuditForm } from "@/components/RunAuditForm";
import { SHOW_ONE_TIME_AUDIT } from "@/lib/features";

export default async function NewAuditPage() {
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);
  const canRun = subActive || org.auditCredits > 0;

  const [targets, collectorRows] = await Promise.all([
    prisma.target.findMany({
      where: { orgId: org.id, authorized: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, value: true },
    }),
    prisma.collector.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, lastSeenAt: true },
    }),
  ]);
  const collectors = collectorRows.map((c) => ({
    id: c.id,
    name: c.name,
    online: !!c.lastSeenAt && Date.now() - new Date(c.lastSeenAt).getTime() < 2 * 60 * 1000,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/audits" className="text-sm text-brand-300 hover:underline">← Back to audits</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">New audit</h1>
        <p className="text-sm text-slate-400">
          {subActive
            ? "Covered by your active subscription — unlimited audits."
            : SHOW_ONE_TIME_AUDIT
              ? `This will consume 1 audit credit. You have ${org.auditCredits}.`
              : "An active monitoring subscription is required to run audits."}
        </p>
      </div>

      <RunAuditForm targets={targets} collectors={collectors} canRun={canRun} />
    </div>
  );
}
