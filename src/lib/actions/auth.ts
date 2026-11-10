"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";
import { registerSchema, loginSchema } from "@/lib/validation";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    orgName: formData.get("orgName"),
    name: formData.get("name") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { orgName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const { user, org, membership } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: email.toLowerCase(), name: name || null, passwordHash },
    });
    const org = await tx.organization.create({
      data: { name: orgName, slug: slugify(orgName) },
    });
    const membership = await tx.membership.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });
    return { user, org, membership };
  });

  await createSession({ userId: user.id, email: user.email, orgId: org.id, role: membership.role });
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  const membership = user.memberships[0];
  if (!membership) {
    return { error: "This account is not attached to any organization." };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    orgId: membership.orgId,
    role: membership.role,
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
