"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { createAudit, EntitlementError, ScopeError, AuthorizationError } from "@/lib/audit";
import { enqueueScan } from "@/lib/queue";
import { runAuditSchema } from "@/lib/validation";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

export async function runAuditAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { session, org } = await requireTenant();

  const targetIds = formData.getAll("targetIds").map(String).filter(Boolean);
  const executor = formData.get("executor") === "COLLECTOR" ? "COLLECTOR" : "CLOUD";
  const parsed = runAuditSchema.safeParse({
    name: formData.get("name"),
    targetIds,
    activeProbes: formData.get("activeProbes") !== "off",
    executor,
    collectorId: formData.get("collectorId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let auditId: string;
  try {
    auditId = await createAudit({
      orgId: org.id,
      userId: session.userId,
      name: parsed.data.name,
      targetIds: parsed.data.targetIds,
      activeProbes: parsed.data.activeProbes,
      executor: parsed.data.executor,
      collectorId: parsed.data.collectorId || null,
    });
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    if (err instanceof ScopeError) return { error: err.message };
    if (err instanceof AuthorizationError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to start audit" };
  }

  // CLOUD audits are dispatched to the worker queue (or run in-process when no
  // Redis is configured). COLLECTOR audits wait for an on-prem agent to claim.
  if (parsed.data.executor === "CLOUD") {
    await enqueueScan(auditId);
  }

  revalidatePath("/dashboard/audits");
  redirect(`/dashboard/audits/${auditId}`);
}
