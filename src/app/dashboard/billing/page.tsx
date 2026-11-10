import { requireTenant, hasActiveSubscription } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { env, PRICING } from "@/lib/env";
import { money, dateTime } from "@/lib/format";
import { checkoutAction, billingPortalAction } from "@/lib/actions/billing";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; mock?: string; granted?: string }>;
}) {
  const sp = await searchParams;
  const { org } = await requireTenant();
  const subActive = hasActiveSubscription(org);

  const payments = await prisma.payment.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-sm text-slate-400">Purchase on-demand audits or manage your monitoring subscription.</p>
      </div>

      {env.billing.mockMode && (
        <div className="card border-amber-400/30 bg-amber-500/5 text-sm text-amber-200">
          <strong>Mock billing mode.</strong> Purchases are granted instantly without charging a card. Set{" "}
          <code className="rounded bg-black/30 px-1">BILLING_MOCK_MODE=false</code> and configure Stripe keys to take real payments.
        </div>
      )}
      {sp.success && <Banner ok>Payment successful — your entitlement is active.</Banner>}
      {sp.granted && <Banner ok>Granted: {sp.granted === "subscription" ? "monitoring subscription" : "1 audit credit"}.</Banner>}
      {sp.canceled && <Banner>Checkout canceled.</Banner>}

      {/* Current status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Current plan</h3>
          <div className="mt-2 text-2xl font-bold text-white">
            {subActive ? "Continuous monitoring" : "Pay-per-audit"}
          </div>
          {subActive ? (
            <p className="mt-1 text-sm text-slate-400">
              Renews {dateTime(org.currentPeriodEnd)} · status {org.subscriptionStatus.toLowerCase()}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">{org.auditCredits} audit credit(s) available</p>
          )}
          <form action={billingPortalAction} className="mt-4">
            <button className="btn-ghost text-sm" type="submit">Manage billing</button>
          </form>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Audit credits</h3>
          <div className="mt-2 text-2xl font-bold text-white">{subActive ? "Unlimited" : org.auditCredits}</div>
          <p className="mt-1 text-sm text-slate-400">Each on-demand audit consumes one credit.</p>
        </div>
      </div>

      {/* Purchase options */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card flex flex-col">
          <h3 className="text-lg font-semibold text-white">On-demand audit</h3>
          <div className="mt-2 text-3xl font-bold text-white">
            {money(PRICING.oneTimeAuditCents)}<span className="text-base font-normal text-slate-400"> / audit</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">One full assessment of your authorized scope. Grants 1 credit.</p>
          <form action={checkoutAction} className="mt-auto pt-5">
            <input type="hidden" name="plan" value="one_time" />
            <button className="btn-ghost w-full" type="submit">Buy one audit</button>
          </form>
        </div>

        <div className="card flex flex-col border-brand-400/40 ring-1 ring-brand-400/30">
          <h3 className="text-lg font-semibold text-white">Continuous monitoring</h3>
          <div className="mt-2 text-3xl font-bold text-white">
            {money(PRICING.subscriptionMonthlyCents)}<span className="text-base font-normal text-slate-400"> / month</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Unlimited audits and scheduled re-scans for an evolving fleet.</p>
          <form action={checkoutAction} className="mt-auto pt-5">
            <input type="hidden" name="plan" value="subscription" />
            <button className="btn-primary w-full" type="submit" disabled={subActive}>
              {subActive ? "Subscription active" : "Start subscription"}
            </button>
          </form>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Payment history</h2>
        {payments.length === 0 ? (
          <div className="card text-sm text-slate-400">No payments yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-400">{dateTime(p.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-200">{p.description ?? p.kind}</td>
                    <td className="px-4 py-3 text-slate-300">{money(p.amountCents, p.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${p.status === "PAID" ? "bg-emerald-500/20 text-emerald-300" : p.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Banner({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div className={`card text-sm ${ok ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-200" : "border-white/10 text-slate-300"}`}>
      {children}
    </div>
  );
}
