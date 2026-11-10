"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { externalCheck, SEVERITY_RANK, type ReconResult } from "@/lib/recon";
import { requireTenant } from "@/lib/tenant";

const schema = z.object({
  domain: z.string().min(3).max(253),
  email: z.string().email("Enter a valid work email"),
});

export interface CheckState {
  ok?: boolean;
  error?: string;
  result?: ReconResult;
}

const RATE_LIMIT_PER_HOUR = 8;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function externalCheckAction(_prev: CheckState, formData: FormData): Promise<CheckState> {
  const parsed = schema.safeParse({ domain: formData.get("domain"), email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ip = await clientIp();

  // Basic abuse control: cap checks per IP per hour.
  if (ip) {
    const recent = await prisma.lead.count({
      where: { ip, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    });
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return { error: "You've reached the hourly limit for free checks. Please try again later or request a full audit." };
    }
  }

  const result = await externalCheck(parsed.data.domain, env.shodanApiKey || undefined);
  if (!result) return { error: "That doesn't look like a valid domain. Try something like acme.com." };

  result.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  await prisma.lead.create({
    data: {
      domain: result.domain,
      email: parsed.data.email,
      ip,
      exposed: result.exposed,
      summary: {
        ips: result.ips.length,
        subdomains: result.subdomains.length,
        printerSubdomains: result.printerSubdomains.length,
        findings: result.findings.length,
        shodanUsed: result.shodanUsed,
      },
    },
  });

  return { ok: true, result };
}

// Operator-only: run a check by domain alone (no email, no lead capture, no
// rate limit). Requires an authenticated session. For researching prospects.
export async function operatorCheckAction(_prev: CheckState, formData: FormData): Promise<CheckState> {
  await requireTenant();
  const domain = String(formData.get("domain") ?? "").trim();
  if (domain.length < 3) return { error: "Enter a domain, e.g. acme.com" };

  const result = await externalCheck(domain, env.shodanApiKey || undefined);
  if (!result) return { error: "That doesn't look like a valid domain. Try something like acme.com." };
  result.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return { ok: true, result };
}
