"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createCollector } from "@/lib/collector";

export interface CollectorActionState {
  ok?: boolean;
  error?: string;
  token?: string; // raw token, shown exactly once
  name?: string;
}

export async function createCollectorAction(
  _prev: CollectorActionState,
  formData: FormData
): Promise<CollectorActionState> {
  const { session, org } = await requireTenant();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Give the collector a name (min 2 chars)." };

  const { token } = await createCollector(org.id, session.userId, name);
  revalidatePath("/dashboard/collectors");
  return { ok: true, token, name };
}

export async function deleteCollectorAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  await prisma.collector.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/dashboard/collectors");
}
