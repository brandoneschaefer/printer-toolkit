"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { createAudit, runAuditJob, EntitlementError, ScopeError } from "@/lib/audit";
import { runAuditSchema } from "@/lib/validation";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

export async function runAuditAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { session, org } = await requireTenant();

  const targetIds = formData.getAll("targetIds").map(String).filter(Boolean);
  const parsed = runAuditSchema.safeParse({
    name: formData.get("name"),
    targetIds,
    activeProbes: formData.get("activeProbes") !== "off",
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
    });
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    if (err instanceof ScopeError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to start audit" };
  }

  // Kick off the scan without blocking the response; the detail page polls.
  void runAuditJob(auditId).catch(() => {
    /* errors are persisted on the audit record inside runAuditJob */
  });

  revalidatePath("/dashboard/audits");
  redirect(`/dashboard/audits/${auditId}`);
}
