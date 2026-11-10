// Collector registration + token authentication.
// A collector token is `<collectorId>.<secret>`. Only bcrypt(secret) is stored,
// so the raw token is shown to the operator exactly once at creation time.

import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export async function createCollector(
  orgId: string,
  userId: string,
  name: string
): Promise<{ id: string; token: string }> {
  const secret = randomBytes(24).toString("base64url");
  const tokenHash = await bcrypt.hash(secret, 11);
  const collector = await prisma.collector.create({
    data: { orgId, name, tokenHash, createdById: userId },
  });
  return { id: collector.id, token: `${collector.id}.${secret}` };
}

export interface AuthedCollector {
  id: string;
  orgId: string;
  name: string;
}

/** Validate a `Bearer <id>.<secret>` header; returns the collector or null. */
export async function authenticateCollector(authHeader: string | null): Promise<AuthedCollector | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!id || !secret) return null;

  const collector = await prisma.collector.findUnique({ where: { id } });
  if (!collector) return null;
  if (!(await bcrypt.compare(secret, collector.tokenHash))) return null;

  // Best-effort liveness marker.
  await prisma.collector.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return { id: collector.id, orgId: collector.orgId, name: collector.name };
}
