import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { grantOneTimeAudit, activateSubscription, setSubscriptionStatus } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (env.billing.mockMode) {
    return NextResponse.json({ ignored: "billing in mock mode" }, { status: 200 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig ?? "", env.billing.stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 }
    );
  }

  async function orgFromCustomer(customerId?: string | null): Promise<string | null> {
    if (!customerId) return null;
    const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } });
    return org?.id ?? null;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = (session.metadata?.orgId as string) || (await orgFromCustomer(session.customer as string));
        if (!orgId) break;
        if (session.mode === "payment") {
          await grantOneTimeAudit(orgId, { sessionId: session.id });
        } else if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await activateSubscription(orgId, {
            stripeSubscriptionId: sub.id,
            plan: "monthly",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            sessionId: session.id,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "ACTIVE"
            : sub.status === "past_due" || sub.status === "unpaid"
              ? "PAST_DUE"
              : "CANCELED";
        await setSubscriptionStatus(sub.id, status, new Date(sub.current_period_end * 1000));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await setSubscriptionStatus(sub.id, "CANCELED");
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await setSubscriptionStatus(invoice.subscription as string, "PAST_DUE");
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handler error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
