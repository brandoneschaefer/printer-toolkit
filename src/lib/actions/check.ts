"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { externalCheck, SEVERITY_RANK, type ReconResult } from "@/lib/recon";
import { requireTenant, getTenant } from "@/lib/tenant";

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
  // Behind the tenant login — only authenticated users may run checks.
  const tenant = await getTenant();
  if (!tenant) return { error: "Please sign in to run an exposure check." };

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

export interface BulkRow {
  domain: string;
  exposed: boolean;
  ips: number;
  findings: number;
  top?: string;
}
export interface BulkState {
  ok?: boolean;
  error?: string;
  rows?: BulkRow[];
  skipped?: number;
}

const MAX_BULK = 50;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Operator-only: bulk-check a list of domains from an uploaded CSV or pasted
// text. Authenticated; passive; no email, no lead capture.
export async function bulkCheckAction(_prev: BulkState, formData: FormData): Promise<BulkState> {
  await requireTenant();

  let text = "";
  const file = formData.get("file");
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > 1_000_000) return { error: "CSV too large (max 1 MB)." };
    text = await file.text();
  }
  text += "\n" + String(formData.get("domains") ?? "");

  const tokens = text
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(tokens)];
  if (unique.length === 0) return { error: "No domains found. Upload a CSV or paste a list." };

  const batch = unique.slice(0, MAX_BULK);
  const skipped = unique.length - batch.length;

  const results = await mapLimit(batch, 6, async (d): Promise<BulkRow | null> => {
    const r = await externalCheck(d, env.shodanApiKey || undefined);
    if (!r) return null; // invalid domain / header cell
    r.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    return { domain: r.domain, exposed: r.exposed, ips: r.ips.length, findings: r.findings.length, top: r.findings[0]?.title };
  });

  const rows = results.filter((x): x is BulkRow => x !== null).sort((a, b) => Number(b.exposed) - Number(a.exposed) || b.findings - a.findings);
  return { ok: true, rows, skipped: skipped > 0 ? skipped : undefined };
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
