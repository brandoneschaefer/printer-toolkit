// Printer Toolkit on-prem collector agent.
//
// Runs INSIDE a customer network, where it can reach printers on private
// VLANs. It polls the Printer Toolkit control plane for jobs scoped to its
// organization, runs the (read-only) scan engine locally, and posts results
// back. Printers never need to be exposed to the internet.
//
//   SENTINEL_URL=https://app.example.com \
//   COLLECTOR_TOKEN=<id.secret> \
//   npx tsx agent/collector.ts
//
// Reuses the exact same scan engine as the cloud runner.

import { runScan } from "../src/lib/scanner";

const BASE = (process.env.SENTINEL_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.COLLECTOR_TOKEN || "";
const POLL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);

if (!TOKEN) {
  console.error("COLLECTOR_TOKEN is required.");
  process.exit(1);
}

const headers = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };

function log(...a: unknown[]) {
  console.log(new Date().toISOString(), ...a);
}

async function claim(): Promise<any | null> {
  const res = await fetch(`${BASE}/api/collector/claim`, { method: "POST", headers });
  if (res.status === 401) throw new Error("unauthorized — check COLLECTOR_TOKEN");
  if (!res.ok) {
    log("claim failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data.job ?? null;
}

async function submit(auditId: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/collector/results`, {
    method: "POST",
    headers,
    body: JSON.stringify({ auditId, ...body }),
  });
  if (!res.ok) log("results post failed:", res.status, await res.text().catch(() => ""));
  else log("results accepted for", auditId);
}

async function runJob(job: any) {
  log(`running job ${job.auditId} "${job.name}" over ${job.hosts.length} host(s)`);
  try {
    const result = await runScan(job.hosts, {
      tcpTimeoutMs: job.tcpTimeoutMs ?? 2500,
      activeProbes: job.activeProbes ?? true,
    });
    const hosts = result.hosts.map((h) => ({
      address: h.address,
      hostname: h.hostname,
      online: h.online,
      openPorts: h.openPorts,
      vendor: h.vendor,
      findings: h.findings,
    }));
    await submit(job.auditId, { hosts });
  } catch (err) {
    await submit(job.auditId, { error: err instanceof Error ? err.message : "scan failed" });
  }
}

async function heartbeat() {
  await fetch(`${BASE}/api/collector/heartbeat`, { method: "POST", headers }).catch(() => {});
}

async function main() {
  log(`Printer Toolkit collector starting — control plane ${BASE}`);
  await heartbeat();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await claim();
      if (job) {
        await runJob(job);
        continue; // immediately check for another job
      }
      await heartbeat();
    } catch (err) {
      log("error:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
