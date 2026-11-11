// Exposure alerting for active monitoring subscribers.
//
// When a SCHEDULED (SUBSCRIPTION) re-scan completes, we diff it against the
// org's previous completed audit and email subscribers about any NEW exposure
// (severity MEDIUM+). On-demand audits never alert — alerting is the value of
// the continuous monitoring plan. Everything here is best-effort: any failure
// is swallowed so it can never break an audit.
//
// Free of "server-only" so the standalone worker can run it.

import { prisma } from "./db";
import { env } from "./env";
import { sendEmail } from "./email";
import type { Severity } from "@prisma/client";

const RANK: Record<Severity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const ALERT_THRESHOLD = RANK.MEDIUM; // only alert on MEDIUM+ new exposures

function key(host: string, checkId: string): string {
  return `${host}|${checkId}`;
}

function subscriptionActive(status: string, currentPeriodEnd: Date | null): boolean {
  if (status !== "ACTIVE") return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

/**
 * If `auditId` is a completed subscription re-scan for an active subscriber and
 * introduced new MEDIUM+ exposures vs the previous audit, email the org's
 * members. Safe no-op when email is unconfigured or nothing is new.
 */
export async function maybeSendExposureAlert(auditId: string): Promise<void> {
  try {
    if (!env.alerts.resendApiKey) return; // email disabled — skip all work

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: { findings: true, org: true },
    });
    if (!audit || audit.status !== "COMPLETED") return;
    // Only scheduled monitoring runs alert — this is the subscription's value.
    if (audit.kind !== "SUBSCRIPTION") return;
    if (!subscriptionActive(audit.org.subscriptionStatus, audit.org.currentPeriodEnd)) return;

    // Previous completed audit for this org, to diff against.
    const prev = await prisma.audit.findFirst({
      where: { orgId: audit.orgId, status: "COMPLETED", id: { not: audit.id }, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      include: { findings: { select: { host: true, checkId: true } } },
    });
    const prevKeys = new Set((prev?.findings ?? []).map((f) => key(f.host, f.checkId)));

    // New findings this run that weren't present last time, MEDIUM+ only.
    const newFindings = audit.findings
      .filter((f) => RANK[f.severity] >= ALERT_THRESHOLD)
      .filter((f) => !prevKeys.has(key(f.host, f.checkId)))
      .sort((a, b) => RANK[b.severity] - RANK[a.severity]);

    if (newFindings.length === 0) return; // nothing new worth an alert

    // Recipients: every member of the org.
    const members = await prisma.membership.findMany({
      where: { orgId: audit.orgId },
      include: { user: { select: { email: true } } },
    });
    const to = Array.from(new Set(members.map((m) => m.user.email).filter(Boolean)));
    if (to.length === 0) return;

    const auditUrl = `${env.appUrl}/dashboard/audits/${audit.id}`;
    const subject = `⚠️ ${newFindings.length} new printer exposure${
      newFindings.length === 1 ? "" : "s"
    } detected — ${audit.org.name}`;

    const rows = newFindings
      .slice(0, 25)
      .map(
        (f) =>
          `<tr>
             <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;">${f.severity}</td>
             <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(f.host)}</td>
             <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(f.title)}</td>
           </tr>`
      )
      .join("");
    const more = newFindings.length > 25 ? `<p>…and ${newFindings.length - 25} more.</p>` : "";

    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:640px;">
        <h2 style="margin:0 0 4px;">New printer exposures detected</h2>
        <p style="color:#475569;margin:0 0 16px;">
          Your scheduled monitoring scan of <strong>${escapeHtml(audit.org.name)}</strong> found
          ${newFindings.length} new exposure${newFindings.length === 1 ? "" : "s"} since the last scan.
          Current risk score: <strong>${audit.riskScore}/100</strong>.
        </p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #cbd5e1;">Severity</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #cbd5e1;">Host</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #cbd5e1;">Finding</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${more}
        <p style="margin:20px 0;">
          <a href="${auditUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
            View full report
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;">
          Printer Toolkit · continuous printer fleet security monitoring. You receive this because your
          organization has an active monitoring subscription.
        </p>
      </div>`;

    await sendEmail({ to, subject, html });
  } catch (err) {
    console.error("[alerts] exposure alert failed:", err instanceof Error ? err.message : err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
