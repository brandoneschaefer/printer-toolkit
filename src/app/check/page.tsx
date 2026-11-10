import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CheckForm } from "@/components/CheckForm";

export const metadata = {
  title: "Free Printer Exposure Check — PRET",
  description: "Check your company's internet-facing printer exposure from just your domain. Passive, non-intrusive.",
};

export default function CheckPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-900 to-ink-800">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-6 w-6 text-brand-400" /> PRET
        </Link>
        <Link href="/register" className="btn-ghost text-sm">Get a full audit</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <span className="badge bg-brand-500/15 text-brand-300">Free · no login · passive</span>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          Is your company exposing printers to the internet?
        </h1>
        <p className="mt-3 text-slate-300">
          Enter your domain and we&apos;ll check public data — DNS, certificate transparency, and internet-scan
          databases — for internet-facing printers, management interfaces, and known exposures. We never touch your
          network.
        </p>

        <div className="mt-8">
          <CheckForm />
        </div>
      </main>
    </div>
  );
}
