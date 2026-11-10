"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { startCheckout, createBillingPortalSession, type PlanKind } from "@/lib/billing";

export async function checkoutAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const plan = String(formData.get("plan")) as PlanKind;
  if (plan !== "one_time" && plan !== "subscription") {
    redirect("/dashboard/billing?error=invalid_plan");
  }
  const result = await startCheckout(org.id, plan);
  redirect(result.url);
}

export async function billingPortalAction(): Promise<void> {
  const { org } = await requireTenant();
  const url = await createBillingPortalSession(org.id);
  redirect(url);
}
