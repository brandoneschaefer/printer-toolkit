// Billing service. Two products:
//   - one-time audit  (grants 1 audit credit)
//   - monthly subscription (unlimited audits / continuous monitoring)
//
// When BILLING_MOCK_MODE is on, purchases are granted instantly without Stripe
// so the whole flow works in local development. In real mode we create Stripe
// Checkout sessions and let the webhook grant entitlements.

import "server-only";
import { prisma } from "./db";
import { env, PRICING } from "./env";
import { getStripe } from "./stripe";

export type PlanKind = "one_time" | "subscription";

export interface CheckoutResult {
  // In real mode, redirect the browser here. In mock mode, this points back
  // to the billing page (entitlement already granted).
  url: string;
  mock: boolean;
}

async function ensureStripeCustomer(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { orgId: org.id },
  });
  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function startCheckout(orgId: string, plan: PlanKind): Promise<CheckoutResult> {
  // --- Mock mode: grant immediately. ---
  if (env.billing.mockMode) {
    if (plan === "one_time") {
      await grantOneTimeAudit(orgId, { mock: true });
    } else {
      await activateSubscription(orgId, {
        stripeSubscriptionId: `mock_sub_${Date.now()}`,
        plan: "monthly",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });
    }
    return { url: `${env.appUrl}/dashboard/billing?mock=1&granted=${plan}`, mock: true };
  }

  // --- Real Stripe Checkout. ---
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(orgId);
  const successUrl = `${env.appUrl}/dashboard/billing?success=1`;
  const cancelUrl = `${env.appUrl}/dashboard/billing?canceled=1`;

  if (plan === "one_time") {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: env.billing.priceOneTime, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orgId, plan },
    });
    await prisma.payment.create({
      data: {
        orgId,
        kind: "ONE_TIME_AUDIT",
        status: "PENDING",
        amountCents: PRICING.oneTimeAuditCents,
        stripeSessionId: session.id,
        description: "On-demand printer security audit",
      },
    });
    return { url: session.url ?? cancelUrl, mock: false };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.billing.priceSubscription, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orgId, plan },
  });
  await prisma.payment.create({
    data: {
      orgId,
      kind: "SUBSCRIPTION",
      status: "PENDING",
      amountCents: PRICING.subscriptionMonthlyCents,
      stripeSessionId: session.id,
      description: "Continuous printer monitoring subscription",
    },
  });
  return { url: session.url ?? cancelUrl, mock: false };
}

export async function createBillingPortalSession(orgId: string): Promise<string> {
  if (env.billing.mockMode) return `${env.appUrl}/dashboard/billing?mock=1`;
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(orgId);
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.appUrl}/dashboard/billing`,
  });
  return portal.url;
}

// --- Entitlement mutations (called by webhook or mock) ---

export async function grantOneTimeAudit(orgId: string, meta: { mock?: boolean; sessionId?: string } = {}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: orgId },
      data: { auditCredits: { increment: 1 } },
    });
    if (meta.sessionId) {
      await tx.payment.updateMany({
        where: { stripeSessionId: meta.sessionId },
        data: { status: "PAID" },
      });
    } else if (meta.mock) {
      await tx.payment.create({
        data: {
          orgId,
          kind: "ONE_TIME_AUDIT",
          status: "PAID",
          amountCents: PRICING.oneTimeAuditCents,
          description: "On-demand audit (mock purchase)",
        },
      });
    }
  });
}

export async function activateSubscription(
  orgId: string,
  data: { stripeSubscriptionId: string; plan: string; currentPeriodEnd: Date; sessionId?: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionPlan: data.plan,
        stripeSubscriptionId: data.stripeSubscriptionId,
        currentPeriodEnd: data.currentPeriodEnd,
      },
    });
    if (data.sessionId) {
      await tx.payment.updateMany({
        where: { stripeSessionId: data.sessionId },
        data: { status: "PAID" },
      });
    }
  });
}

export async function setSubscriptionStatus(
  stripeSubscriptionId: string,
  status: "ACTIVE" | "PAST_DUE" | "CANCELED",
  currentPeriodEnd?: Date
): Promise<void> {
  const org = await prisma.organization.findFirst({ where: { stripeSubscriptionId } });
  if (!org) return;
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: status,
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    },
  });
}
