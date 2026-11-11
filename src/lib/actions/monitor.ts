"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { expandScope } from "@/lib/scanner/targets";
import { computeNextRun } from "@/lib/audit-core";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export interface TrackActionState {
  ok?: boolean;
  error?: string;
  host?: string;
}

/** Reduce any URL / domain / IP the user types to a bare hostname. */
function normalizeUrlToHost(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s; // add scheme so URL() parses
  try {
    const host = new URL(s).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Track a URL: normalize to a host, record the authorization attestation on the
 * target, and create a WEEKLY cloud monitoring schedule for it. One target +
 * one schedule per tracked URL, so removing the URL removes its monitoring.
 */
export async function trackUrlAction(_prev: TrackActionState, formData: FormData): Promise<TrackActionState> {
  const { session, org } = await requireTenant();

  const attested = formData.get("authorized") === "on" || formData.get("authorized") === "true";
  if (!attested) return { error: "Please confirm you are authorized to monitor this URL." };

  const host = normalizeUrlToHost(String(formData.get("url") ?? ""));
  if (!host) return { error: "Enter a valid URL or domain, e.g. example.com." };

  const { hosts, errors } = expandScope([host], env.scanner.maxHosts);
  if (hosts.length === 0) return { error: errors[0] ?? `Could not parse a host from "${host}".` };

  const existing = await prisma.target.findFirst({ where: { orgId: org.id, value: host } });
  if (existing) return { error: `You're already tracking ${host}.` };

  const { scheduleId } = await prisma.$transaction(async (tx) => {
    const target = await tx.target.create({
      data: {
        orgId: org.id,
        createdById: session.userId,
        label: host,
        value: host,
        authorized: true, // the attestation checkbox is the authorization
      },
    });
    const schedule = await tx.schedule.create({
      data: {
        orgId: org.id,
        createdById: session.userId,
        name: `Monitor ${host}`,
        targetIds: [target.id],
        cadence: "WEEKLY",
        activeProbes: true,
        executor: "CLOUD",
        enabled: true,
        nextRunAt: computeNextRun("WEEKLY"),
      },
    });
    return { scheduleId: schedule.id };
  });

  const subActive =
    org.subscriptionStatus === "ACTIVE" &&
    (!org.currentPeriodEnd || new Date(org.currentPeriodEnd).getTime() > Date.now());

  // Kick off an immediate first scan for active subscribers (don't wait a week).
  if (subActive) {
    try {
      const { createAuditFromSchedule } = await import("@/lib/audit-core");
      const { enqueueScan } = await import("@/lib/queue");
      const auditId = await createAuditFromSchedule(scheduleId);
      if (auditId) await enqueueScan(auditId);
    } catch (err) {
      console.error("[monitor] immediate scan failed:", err instanceof Error ? err.message : err);
    }
  }

  // Confirmation email to the org (best-effort; no-op if email is unconfigured).
  try {
    const members = await prisma.membership.findMany({
      where: { orgId: org.id },
      include: { user: { select: { email: true } } },
    });
    const to = Array.from(new Set(members.map((m) => m.user.email).filter(Boolean)));
    if (to.length > 0) {
      await sendEmail({
        to,
        subject: `You're now monitoring ${host} — Printer Toolkit`,
        html: confirmationHtml(host, subActive),
      });
    }
  } catch (err) {
    console.error("[monitor] confirmation email failed:", err instanceof Error ? err.message : err);
  }

  revalidatePath("/dashboard/monitor");
  revalidatePath("/dashboard/alerts");
  return { ok: true, host };
}

/**
 * Run an immediate scan for a tracked URL, outside its weekly cadence. Uses the
 * URL's monitoring schedule, so it inherits the same subscription gate (returns
 * without scanning if the subscription is inactive).
 */
export async function scanUrlNowAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const targetId = String(formData.get("id"));
  const target = await prisma.target.findFirst({ where: { id: targetId, orgId: org.id } });
  if (!target) return;

  const schedule = await prisma.schedule.findFirst({
    where: { orgId: org.id, targetIds: { has: targetId } },
  });
  if (!schedule) return;

  const { createAuditFromSchedule } = await import("@/lib/audit-core");
  const { enqueueScan } = await import("@/lib/queue");
  const auditId = await createAuditFromSchedule(schedule.id);
  if (auditId) await enqueueScan(auditId);

  revalidatePath("/dashboard/monitor");
  revalidatePath("/dashboard/alerts");
}

/** Stop tracking a URL: delete its target and the schedule(s) that watch it. */
export async function untrackUrlAction(formData: FormData): Promise<void> {
  const { org } = await requireTenant();
  const id = String(formData.get("id"));
  const target = await prisma.target.findFirst({ where: { id, orgId: org.id } });
  if (!target) return;

  await prisma.$transaction(async (tx) => {
    const schedules = await tx.schedule.findMany({
      where: { orgId: org.id, targetIds: { has: target.id } },
    });
    for (const s of schedules) {
      const remaining = s.targetIds.filter((t) => t !== target.id);
      if (remaining.length === 0) {
        await tx.schedule.delete({ where: { id: s.id } });
      } else {
        await tx.schedule.update({ where: { id: s.id }, data: { targetIds: remaining } });
      }
    }
    await tx.target.delete({ where: { id: target.id } });
  });

  revalidatePath("/dashboard/monitor");
}

/** Branded confirmation email shown right after a URL is added. */
function confirmationHtml(host: string, subActive: boolean): string {
  const statusLine = subActive
    ? `Your first scan is running now — results will appear under <strong>Alerts</strong> within a few minutes.`
    : `Start your subscription to activate weekly monitoring for this URL.`;
  const cta = `${env.appUrl}/dashboard/alerts`;
  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px;">
      <h2 style="margin:0 0 6px;">You're all set ✅</h2>
      <p style="color:#475569;margin:0 0 16px;">
        <strong>${escapeHtml(host)}</strong> is now being monitored by Printer Toolkit. We check it every week
        for printer-security exposures — open print ports, default SNMP, unauthenticated admin, and default
        credentials — and email you the moment a new one appears.
      </p>
      <p style="margin:0 0 20px;">${statusLine}</p>
      <p style="margin:0 0 24px;">
        <a href="${cta}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
          View your alerts
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;">Printer Toolkit · continuous printer fleet security monitoring.</p>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
