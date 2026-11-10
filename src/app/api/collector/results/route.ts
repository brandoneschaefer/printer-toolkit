import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateCollector } from "@/lib/collector";
import { persistResults, markAuditFailed } from "@/lib/audit";
import type { HostResult } from "@/lib/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const severity = z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const findingSchema = z.object({
  host: z.string().max(255),
  port: z.number().int().min(0).max(65535).optional(),
  protocol: z.string().max(32).optional(),
  checkId: z.string().max(64),
  title: z.string().max(200),
  severity,
  description: z.string().max(4000),
  evidence: z.string().max(4000).optional(),
  recommendation: z.string().max(4000),
});

const hostSchema = z.object({
  address: z.string().max(255),
  hostname: z.string().max(255).optional(),
  online: z.boolean(),
  openPorts: z.array(z.number().int().min(0).max(65535)).max(64),
  vendor: z.string().max(64).optional(),
  findings: z.array(findingSchema).max(500),
});

const bodySchema = z.object({
  auditId: z.string().min(1),
  error: z.string().max(1000).optional(),
  hosts: z.array(hostSchema).max(1024).optional(),
});

export async function POST(req: NextRequest) {
  const collector = await authenticateCollector(req.headers.get("authorization"));
  if (!collector) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  }

  // The audit must belong to this collector and be in-flight.
  const audit = await prisma.audit.findFirst({
    where: { id: parsed.data.auditId, orgId: collector.orgId, collectorId: collector.id },
  });
  if (!audit) return NextResponse.json({ error: "job not found" }, { status: 404 });
  if (audit.status !== "RUNNING") {
    return NextResponse.json({ error: `job is ${audit.status}, not RUNNING` }, { status: 409 });
  }

  if (parsed.data.error) {
    await markAuditFailed(audit.id, `Collector error: ${parsed.data.error}`);
    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  // Risk score + summary are recomputed inside persistResults from the
  // submitted findings — never trusted from the client.
  const hosts = (parsed.data.hosts ?? []).map((h) => ({
    address: h.address,
    hostname: h.hostname,
    online: h.online,
    openPorts: h.openPorts,
    vendor: h.vendor,
    ports: [],
    findings: h.findings,
  })) as HostResult[];

  await persistResults(audit.id, hosts);
  return NextResponse.json({ ok: true, status: "COMPLETED" });
}
