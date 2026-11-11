import Link from "next/link";
import { ShieldCheck, Network, Lock, FileSearch, Repeat, Building2 } from "lucide-react";
import { PRICING } from "@/lib/env";
import { money } from "@/lib/format";
import { getSession } from "@/lib/auth";

// Launch toggle: hide the one-time "On-demand audit" tier until ~30 days
// post-launch. Flip to `true` to restore it — the card markup is kept below.
const SHOW_ONE_TIME_AUDIT = false;

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-900 via-ink-900 to-ink-800">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-6 w-6 text-brand-400" />
          Printer Toolkit
        </div>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard" className="btn-primary">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Start an audit
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10 text-center">
        <span className="badge bg-brand-500/15 text-brand-300">Printer fleet security monitoring &amp; alerts</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">
          Find the printers quietly exposing your corporate network
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          Printer Toolkit audits your authorized printer fleet for exposed printing protocols, default SNMP
          communities, unencrypted management interfaces, and default credentials — then hands you a prioritized
          remediation report. Read-only by design. Safe to run on live production devices.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Run your first audit
          </Link>
          <Link href="#pricing" className="btn-ghost px-6 py-3 text-base">
            View pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Network />} title="Protocol exposure mapping">
            Detects open RAW/JetDirect (9100), LPD (515), IPP (631), Telnet, and FTP across your scope.
          </Feature>
          <Feature icon={<Lock />} title="Default SNMP & credential checks">
            Tests for manufacturer-default SNMP community strings and well-known web-admin default passwords.
          </Feature>
          <Feature icon={<FileSearch />} title="Unauthenticated PJL detection">
            Read-only PJL identity queries reveal devices accepting unauthenticated control commands.
          </Feature>
          <Feature icon={<ShieldCheck />} title="Prioritized remediation">
            Every finding ships with a severity rating and a concrete hardening recommendation.
          </Feature>
          <Feature icon={<Repeat />} title="Continuous monitoring">
            Subscribe for ongoing re-audits so new exposures are caught as your fleet changes.
          </Feature>
          <Feature icon={<Building2 />} title="Multi-tenant by design">
            Each company is fully isolated. Scope, targets, audits, and billing never cross tenant boundaries.
          </Feature>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-center text-3xl font-bold text-white">Simple, transparent pricing</h2>
        <p className="mt-2 text-center text-slate-400">
          {SHOW_ONE_TIME_AUDIT
            ? "Run a one-off audit, or subscribe for continuous fleet monitoring."
            : "Subscribe for continuous fleet monitoring."}
        </p>
        <div
          className={`mx-auto mt-10 grid gap-6 ${
            SHOW_ONE_TIME_AUDIT ? "max-w-3xl sm:grid-cols-2" : "max-w-md"
          }`}
        >
          {SHOW_ONE_TIME_AUDIT && (
            <div className="card flex flex-col">
              <h3 className="text-lg font-semibold text-white">On-demand audit</h3>
              <p className="mt-1 text-sm text-slate-400">A single full assessment of your authorized scope.</p>
              <div className="mt-5 text-4xl font-bold text-white">
                {money(PRICING.oneTimeAuditCents)}
                <span className="text-base font-normal text-slate-400"> / audit</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>✓ Full protocol & credential assessment</li>
                <li>✓ Prioritized remediation report</li>
                <li>✓ Up to {process.env.SCANNER_MAX_HOSTS ?? 256} hosts per audit</li>
                <li>✓ Export-ready findings</li>
              </ul>
              <Link href="/register" className="btn-ghost mt-6">
                Buy an audit
              </Link>
            </div>
          )}
          <div className="card flex flex-col border-brand-400/40 ring-1 ring-brand-400/30">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Continuous monitoring</h3>
              <span className="badge bg-brand-500/20 text-brand-300">Popular</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Unlimited re-audits for an evolving fleet.</p>
            <div className="mt-5 text-4xl font-bold text-white">
              {money(PRICING.subscriptionMonthlyCents)}
              <span className="text-base font-normal text-slate-400"> / month</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li>{SHOW_ONE_TIME_AUDIT ? "✓ Everything in on-demand" : "✓ Full protocol & credential assessment"}</li>
              <li>✓ Unlimited audits</li>
              <li>✓ Scheduled re-scans</li>
              <li>✓ Email alerts on new exposures</li>
              <li>✓ Trend tracking across audits</li>
            </ul>
            <Link href="/register" className="btn-primary mt-6">
              Start subscription
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          <p>
            Printer Toolkit performs <strong className="text-slate-400">authorized, non-destructive</strong> security
            assessment only. You must own or have explicit written authorization to test every host in your scope.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Printer Toolkit</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{children}</p>
    </div>
  );
}
