"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { targetSchema } from "@/lib/validation";
import { expandScope } from "@/lib/scanner/targets";
import { env } from "@/lib/env";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

export async function createTargetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { session, org } = await requireTenant();

  const parsed = targetSchema.safeParse({
    label: formData.get("label"),
    value: formData.get("value"),
    authorized: formData.get("authorized") === "on" || formData.get("authorized") === "true",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Validate the scope expands to something sane before saving.
  const { hosts, errors } = expandScope([parsed.data.value], env.scanner.maxHosts);
  if (hosts.length === 0) {
    return { error: errors[0] ?? "Could not parse that host or CIDR range." };
  }

  await prisma.target.create({
    data: {
      orgId: org.id,
      createdById: session.userId,
      label: parsed.data.label,
      value: parsed.data.value.trim(),
      authorized: parsed.data.authorized,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/dashboard/targets");
  return { ok: true };
}

export async function deleteTargetAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  // Scoped delete: can only remove targets in the caller's own org.
  await prisma.target.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/dashboard/targets");
}

export async function toggleAuthorizedAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  const target = await prisma.target.findFirst({ where: { id, orgId: org.id } });
  if (target) {
    await prisma.target.update({
      where: { id: target.id },
      data: { authorized: !target.authorized },
    });
  }
  revalidatePath("/dashboard/targets");
}
