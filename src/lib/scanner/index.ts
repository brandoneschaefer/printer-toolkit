// Scan orchestrator. Probes each host for printer-relevant exposure and
// derives findings. All probes are read-only / non-destructive.

import { probePort, pjlInfo } from "./tcp";
import { snmpDefaultCommunity } from "./snmp";
import { httpProbe } from "./http";
import { PRINTER_PORTS, makeFinding, riskScore, severityCounts } from "./checks";
import { guessVendor, classifyDevice, extractModel } from "./vendors";
import type { HostResult, RawFinding, ScanOptions, ScanResult } from "./types";

async function scanHost(host: string, opts: ScanOptions): Promise<HostResult> {
  const findings: RawFinding[] = [];
  // Accumulated identity strings (PJL ID, web banners, SNMP sysDescr) used to
  // fingerprint vendor / model / device type at the end.
  const identity: string[] = [];

  // 1. TCP port sweep (parallel).
  const portResults = await Promise.all(
    PRINTER_PORTS.map(async (p) => {
      const res = await probePort(host, p.port, opts.tcpTimeoutMs, p.readBanner);
      return { port: p.port, proto: p.proto, open: res.open, banner: res.banner };
    })
  );

  const openPorts = portResults.filter((p) => p.open).map((p) => p.port);
  const online = openPorts.length > 0;

  const isOpen = (port: number) => openPorts.includes(port);

  // 2. Port-exposure findings.
  if (isOpen(23)) findings.push(makeFinding("telnet-enabled", host, { port: 23, protocol: "TELNET" }));
  if (isOpen(21)) findings.push(makeFinding("ftp-enabled", host, { port: 21, protocol: "FTP" }));
  if (isOpen(515)) findings.push(makeFinding("lpd-enabled", host, { port: 515, protocol: "LPD" }));
  if (isOpen(631)) findings.push(makeFinding("ipp-open", host, { port: 631, protocol: "IPP" }));

  // 3. Raw/9100 + PJL.
  if (isOpen(9100)) {
    findings.push(makeFinding("raw-9100-open", host, { port: 9100, protocol: "RAW" }));
    if (opts.activeProbes) {
      const pjl = await pjlInfo(host, 9100, opts.tcpTimeoutMs);
      if (pjl) {
        identity.push(pjl);
        const evidence = pjl.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ").trim().slice(0, 400);
        findings.push(makeFinding("pjl-unauthenticated", host, { port: 9100, protocol: "PJL", evidence }));
      }
    }
  }

  // 4. HTTP / HTTPS management interfaces.
  if (isOpen(80)) {
    const probe = await httpProbe(host, 80, "http", opts.tcpTimeoutMs, opts.activeProbes);
    if (probe?.reachable) {
      identity.push(`${probe.server ?? ""} ${probe.title ?? ""}`);
      findings.push(makeFinding("http-admin-plaintext", host, { port: 80, protocol: "HTTP", evidence: probe.server || probe.title }));
      if (!probe.requiresAuth && probe.statusCode && probe.statusCode < 400) {
        findings.push(makeFinding("http-admin-noauth", host, { port: 80, protocol: "HTTP" }));
      }
      if (probe.defaultCredential) {
        findings.push(makeFinding("http-default-credentials", host, { port: 80, protocol: "HTTP", evidence: probe.defaultCredential }));
      }
    }
  }
  if (isOpen(443)) {
    const probe = await httpProbe(host, 443, "https", opts.tcpTimeoutMs, opts.activeProbes);
    if (probe?.reachable) {
      identity.push(`${probe.server ?? ""} ${probe.title ?? ""}`);
      findings.push(makeFinding("tls-weak", host, { port: 443, protocol: "HTTPS", evidence: probe.server }));
      if (probe.defaultCredential) {
        findings.push(makeFinding("http-default-credentials", host, { port: 443, protocol: "HTTPS", evidence: probe.defaultCredential }));
      }
    }
  }

  // 5. SNMP default community (UDP/161) — independent of the TCP sweep.
  if (opts.activeProbes) {
    const snmp = await snmpDefaultCommunity(host, opts.tcpTimeoutMs);
    if (snmp?.ok) {
      if (snmp.sysDescr) identity.push(snmp.sysDescr);
      const evidence = `community="${snmp.community}" ${snmp.version}${snmp.sysDescr ? ` | ${snmp.sysDescr.slice(0, 200)}` : ""}`;
      findings.push(makeFinding("snmp-default-community", host, { port: 161, protocol: "SNMP", evidence }));
    }
  }

  // Fingerprint from everything we learned.
  const identityText = identity.join(" ").trim();
  const vendor = guessVendor(identityText);
  const deviceType = classifyDevice(identityText);
  const model = extractModel(identityText);

  return {
    address: host,
    online,
    openPorts,
    vendor,
    model,
    deviceType,
    ports: portResults.map((p) => ({ port: p.port, open: p.open, banner: p.banner })),
    findings,
  };
}

/** Bounded-concurrency map. */
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

export async function runScan(hosts: string[], opts: ScanOptions): Promise<ScanResult> {
  const startedAt = new Date();
  const hostResults = await mapLimit(hosts, 16, (h) => scanHost(h, opts));
  return { hosts: hostResults, startedAt, completedAt: new Date() };
}

export { riskScore, severityCounts };
export type { HostResult, RawFinding, ScanResult, ScanOptions };
