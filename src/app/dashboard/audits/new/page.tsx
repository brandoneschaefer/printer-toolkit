import Link from "next/link";
import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { RunAuditForm } from "@/components/RunAuditForm";

export default async function NewAuditPage() {
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);
  const canRun = subActive || org.auditCredits > 0;

  const targets = await prisma.target.findMany({
    where: { orgId: org.id, authorized: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, value: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/audits" className="text-sm text-brand-300 hover:underline">← Back to audits</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">New audit</h1>
        <p className="text-sm text-slate-400">
          {subActive
            ? "Covered by your active subscription — unlimited audits."
            : `This will consume 1 audit credit. You have ${org.auditCredits}.`}
        </p>
      </div>

      <RunAuditForm targets={targets} canRun={canRun} />
    </div>
  );
}
