"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { authorizationSchema } from "@/lib/validation";
import { authorizationStatement } from "@/lib/authorization-text";

export interface AuthorizationActionState {
  ok?: boolean;
  error?: string;
}

export async function createAuthorizationAction(
  _prev: AuthorizationActionState,
  formData: FormData
): Promise<AuthorizationActionState> {
  const { session, org } = await requireTenant();

  const parsed = authorizationSchema.safeParse({
    signerName: formData.get("signerName"),
    signerTitle: formData.get("signerTitle") ?? "",
    signerEmail: formData.get("signerEmail"),
    scope: formData.get("scope"),
    accept: formData.get("accept") === "on" || formData.get("accept") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Supersede any prior active authorization.
  await prisma.$transaction(async (tx) => {
    await tx.authorization.updateMany({
      where: { orgId: org.id, active: true },
      data: { active: false, revokedAt: new Date() },
    });
    await tx.authorization.create({
      data: {
        orgId: org.id,
        createdById: session.userId,
        signerName: parsed.data.signerName,
        signerTitle: parsed.data.signerTitle || null,
        signerEmail: parsed.data.signerEmail,
        scope: parsed.data.scope,
        statement: authorizationStatement(org.name),
        active: true,
      },
    });
  });

  revalidatePath("/dashboard/authorization");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function revokeAuthorizationAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  await prisma.authorization.updateMany({
    where: { id, orgId: org.id, active: true },
    data: { active: false, revokedAt: new Date() },
  });
  revalidatePath("/dashboard/authorization");
}
