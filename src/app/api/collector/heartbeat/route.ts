import { NextRequest, NextResponse } from "next/server";
import { authenticateCollector } from "@/lib/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness check. authenticateCollector updates lastSeenAt as a side effect.
export async function POST(req: NextRequest) {
  const collector = await authenticateCollector(req.headers.get("authorization"));
  if (!collector) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, collector: collector.name });
}
