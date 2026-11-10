import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import type { ReconResult } from "@/lib/recon";

async function load(token: string) {
  const report = await prisma.exposureReport.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });
  return report;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const report = await load(token);
  if (!report) return { title: "Printer Exposure Report — PRET" };
  const verdict = report.exposed ? "Exposure detected" : "No external exposure";
  return {
    title: `Printer Exposure Report — ${report.domain}`,
    description: `${verdict} for ${report.domain}. External printer-security exposure check.`,
    openGraph: {
      title: `Printer Exposure Report — ${report.domain}`,
      description: `${verdict} for ${report.domain}.`,
    },
  };
}

export default async function PublicExposurePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await load(token);
  if (!report) notFound();

  const r = report.result as unknown as ReconResult;
  const org = report.org?.name ?? "PRET";

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-900 via-ink-900 to-ink-800">
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <ShieldCheck className="h-6 w-6 text-brand-400" /> PRET
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Prepared by {org}</div>
            <div>{dateTime(report.createdAt)}</div>
          </div>
        </div>

        {/* Hero verdict */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <div className={`p-8 ${r.exposed ? "bg-gradient-to-br from-red-500/15 to-ink-800" : "bg-gradient-to-br from-emerald-500/15 to-ink-800"}`}>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Printer Exposure Report</div>
            <div className="mt-2 font-mono text-xl text-slate-200">{r.domain}</div>
            <div className="mt-5 flex items-start gap-4">
              {r.exposed ? <ShieldAlert className="h-12 w-12 shrink-0 text-red-400" /> : <ShieldCheck className="h-12 w-12 shrink-0 text-emerald-400" />}
              <div>
                <h1 className={`text-2xl font-bold sm:text-3xl ${r.exposed ? "text-red-300" : "text-emerald-300"}`}>
                  {r.exposed ? "Internet-facing printer exposure detected" : "No external printer exposure found"}
                </h1>
                <p className="mt-2 text-slate-300">
                  {r.exposed
                    ? "The devices below are reachable from the public internet, where anyone — including attackers — can see them."
                    : "Nothing is exposed to the internet from the outside. But the majority of printer risk lives inside the network, where it can't be seen from here."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["Public IPs", r.ips.length],
            ["Subdomains found", r.subdomains.length],
            ["Printer-like hostnames", r.printerSubdomains.length],
          ].map(([label, val]) => (
            <div key={label as string} className="rounded-xl border border-white/10 bg-ink-800/60 p-5 text-center">
              <div className="text-3xl font-bold text-white">{val as number}</div>
              <div className="mt-1 text-xs text-slate-400">{label as string}</div>
            </div>
          ))}
        </div>

        {/* Findings */}
        {r.findings.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-white">What we found</h2>
            <div className="space-y-3">
              {r.findings.map((f, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-ink-800/60 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge sev-${f.severity}`}>{f.severity}</span>
                      <span className="font-semibold text-white">{f.title}</span>
                    </div>
                    <span className="text-xs text-slate-500">{f.source}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-semibold text-slate-200">What this means: </span>{f.detail}
                  </p>
                  {f.recommendation && (
                    <div className="mt-3 rounded-lg border border-brand-400/20 bg-brand-500/5 p-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-300">How to fix</span>
                      <p className="mt-1 text-sm text-slate-200">{f.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-brand-400/40 bg-gradient-to-br from-brand-500/15 to-ink-800 p-8 text-center ring-1 ring-brand-400/20">
          <h2 className="text-xl font-bold text-white">This only shows what&apos;s visible from the outside</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-300">
            Most printer and copier risk — default passwords, open management, unencrypted protocols, stored
            documents — lives on the internal network and is invisible from the internet. A full audit finds it.
          </p>
          <Link href="/register" className="btn-primary mt-5 px-6 py-3 text-base">
            Get a full printer security audit
          </Link>
          <p className="mt-3 text-xs text-slate-400">Prepared by {org} · Powered by PRET</p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          This assessment is passive and non-intrusive — it uses only public data and never connects to {r.domain}&apos;s network.
        </p>
      </div>
    </div>
  );
}
