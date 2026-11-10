// Tenant context helpers. Every data access goes through the active org.

import "server-only";
import { prisma } from "./db";
import { getSession, requireSession, type SessionPayload } from "./auth";

export interface TenantContext {
  session: SessionPayload;
  org: {
    id: string;
    name: string;
    slug: string;
    auditCredits: number;
    subscriptionStatus: string;
    subscriptionPlan: string | null;
    currentPeriodEnd: Date | null;
    stripeCustomerId: string | null;
  };
}

/** Resolve the active tenant for the current request, or null if unauthenticated. */
export async function getTenant(): Promise<TenantContext | null> {
  const session = await getSession();
  if (!session) return null;
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      auditCredits: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });
  if (!org) return null;
  return { session, org };
}

export async function requireTenant(): Promise<TenantContext> {
  const session = await requireSession();
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      auditCredits: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });
  if (!org) throw new Error("Active organization not found");
  return { session, org };
}

export function hasActiveSubscription(org: TenantContext["org"]): boolean {
  if (org.subscriptionStatus !== "ACTIVE") return false;
  if (!org.currentPeriodEnd) return true;
  return org.currentPeriodEnd.getTime() > Date.now();
}

export function isAdmin(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}
