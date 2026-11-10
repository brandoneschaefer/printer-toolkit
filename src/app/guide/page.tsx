import { requireTenant } from "@/lib/tenant";
import { PrintButton } from "@/components/PrintButton";

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; contact?: string; device?: string }>;
}) {
  const sp = await searchParams;
  const { session } = await requireTenant();

  const provider = "PRET";
  const client = sp.client?.trim() || "your organization";
  const contact = sp.contact?.trim() || session.email;
  const device = sp.device?.trim() || "PRET Monitoring Sensor";

  return (
    <div className="min-h-screen bg-slate-100 py-8 text-slate-900">
      <div className="print-page mx-auto max-w-3xl rounded-lg bg-white p-10 shadow-xl">
        <div className="no-print mb-6 flex items-center justify-between">
          <a href="/dashboard/collectors" className="text-sm text-brand-600 hover:underline">← Back</a>
          <PrintButton auto />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
          <div>
            <div className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">🛡</span>
              PRET
            </div>
            <div className="mt-1 text-sm font-medium text-slate-500">Printer Security Monitoring — Setup Guide</div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <div className="font-semibold text-slate-700">Prepared for</div>
            <div className="text-slate-900">{client}</div>
          </div>
        </div>

        {/* Intro */}
        <p className="mt-5 text-sm leading-relaxed text-slate-700">
          Your {device} continuously checks the printers on your network for security weaknesses — exposed
          management interfaces, default passwords, and insecure protocols — and reports them to a secure cloud
          dashboard monitored by <strong>{provider}</strong>. Setup takes about two minutes and requires no technical
          knowledge.
        </p>

        {/* Getting started */}
        <h2 className="mt-7 text-lg font-bold text-slate-900">Getting started</h2>
        <ol className="mt-3 space-y-3">
          {[
            ["Place the sensor", "Set the PRET sensor near your main network switch or router."],
            ["Connect power", "Plug in the included power adapter. A light will indicate it has powered on."],
            ["Connect the network", "Plug the ethernet cable from the sensor into any open port on your switch or router."],
            ["You're done", "The sensor activates automatically within a few minutes and begins its first assessment. There is nothing to install on your computers."],
          ].map(([title, body], i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="text-sm text-slate-600">{body}</div>
              </div>
            </li>
          ))}
        </ol>

        {/* Two-up: what happens next + security */}
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">What happens next</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>• Your printer fleet is assessed automatically.</li>
              <li>• You receive a clear, prioritized report of any issues.</li>
              <li>• Ongoing monitoring flags new exposures as they appear.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">Safe &amp; private</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>• Read-only — it never changes or disrupts your devices.</li>
              <li>• Outbound-only — it opens no inbound ports on your network.</li>
              <li>• Stores nothing locally; all data stays in the secure cloud.</li>
            </ul>
          </div>
        </div>

        {/* Support */}
        <div className="mt-7 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <h3 className="text-sm font-bold text-brand-800">Need help?</h3>
          <p className="mt-1 text-sm text-slate-700">
            Contact {provider} at <strong>{contact}</strong>. If the sensor does not appear active within 15 minutes,
            check that the power and ethernet cables are firmly connected, then reach out.
          </p>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          Confidential — prepared for {client} by {provider}. Powered by PRET (Printer Exploitation Toolkit).
          Monitoring is authorized, non-destructive, and limited to the networks you have authorized.
        </div>
      </div>
    </div>
  );
}
