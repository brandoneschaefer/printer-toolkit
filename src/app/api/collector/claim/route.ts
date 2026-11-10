import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { authenticateCollector } from "@/lib/collector";
import { expandScope } from "@/lib/scanner/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A collector polls this endpoint for the next job assigned to it.
export async function POST(req: NextRequest) {
  const collector = await authenticateCollector(req.headers.get("authorization"));
  if (!collector) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Oldest queued collector-audit assigned to this collector.
  const audit = await prisma.audit.findFirst({
    where: { orgId: collector.orgId, collectorId: collector.id, executor: "COLLECTOR", status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!audit) return NextResponse.json({ job: null });

  // Atomically claim it (guards against two collector instances racing).
  const claimed = await prisma.audit.updateMany({
    where: { id: audit.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), claimedAt: new Date() },
  });
  if (claimed.count === 0) return NextResponse.json({ job: null });

  const scope = audit.scope as any;
  const targetValues: string[] = (scope?.targets ?? []).map((t: any) => t.value);
  const activeProbes: boolean = scope?.activeProbes ?? true;
  const { hosts } = expandScope(targetValues, env.scanner.maxHosts);

  return NextResponse.json({
    job: {
      auditId: audit.id,
      name: audit.name,
      hosts,
      activeProbes,
      tcpTimeoutMs: env.scanner.tcpTimeoutMs,
    },
  });
}
