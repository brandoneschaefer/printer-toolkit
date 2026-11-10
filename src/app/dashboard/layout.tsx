import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Crosshair, FileSearch, CreditCard, LogOut } from "lucide-react";
import { getTenant, hasActiveSubscription } from "@/lib/tenant";
import { logoutAction } from "@/lib/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  if (!tenant) redirect("/login");
  const { org, session } = tenant;
  const subActive = hasActiveSubscription(org);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-ink-800/60 p-5 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-6 w-6 text-brand-400" /> SentinelPrint
        </Link>

        <nav className="mt-8 space-y-1">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Overview</NavLink>
          <NavLink href="/dashboard/targets" icon={<Crosshair className="h-4 w-4" />}>Targets &amp; scope</NavLink>
          <NavLink href="/dashboard/audits" icon={<FileSearch className="h-4 w-4" />}>Audits</NavLink>
          <NavLink href="/dashboard/billing" icon={<CreditCard className="h-4 w-4" />}>Billing</NavLink>
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-lg border border-white/10 bg-ink-900 p-3 text-xs">
            <div className="font-semibold text-slate-300">{org.name}</div>
            <div className="mt-1 text-slate-500">{session.email}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate-500">Plan</span>
              <span className={subActive ? "text-emerald-400" : "text-slate-400"}>
                {subActive ? "Subscription" : "Pay-per-audit"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Credits</span>
              <span className="text-slate-300">{subActive ? "∞" : org.auditCredits}</span>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="btn-ghost w-full justify-start text-sm" type="submit">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white">
            <ShieldCheck className="h-5 w-5 text-brand-400" /> SentinelPrint
          </Link>
          <form action={logoutAction}>
            <button className="btn-ghost text-sm" type="submit"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}
