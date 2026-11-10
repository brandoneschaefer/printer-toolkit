// External Exposure Check — PASSIVE reconnaissance from a domain name only.
//
// Makes NO connection to the target. It uses:
//  - DNS resolution (to find the org's public IPs)
//  - Certificate Transparency logs via crt.sh (to find subdomains)
//  - Shodan's internet-wide scan database (to find already-exposed services)
//
// Because nothing touches the target network, this is OSINT: safe to run on a
// prospect without authorization. The full (authorized) audit is what actually
// probes the fleet.

import dns from "node:dns/promises";

const PRINTER_PORTS = [9100, 515, 631, 161, 23, 21, 80, 443];
const PRINTER_HINTS = [
  "jetdirect", "pjl", "ipp", "cups", "printer", "laserjet", "officejet", "chaiserver",
  "lexmark", "canon", "epson", "brother", "xerox", "ricoh", "kyocera", "konica", "sharp", "oki",
];
const PRINTER_SUBDOMAIN_HINTS = ["print", "printer", "mfp", "copier", "scan", "jetdirect"];

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ExposureFinding {
  severity: Severity;
  title: string;
  detail: string;
  source: string; // "Shodan", "Certificate Transparency", "DNS"
}

export interface ReconResult {
  domain: string;
  ips: string[];
  subdomains: string[];
  printerSubdomains: string[];
  findings: ExposureFinding[];
  exposed: boolean;
  shodanUsed: boolean;
  notes: string[];
}

function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  // basic hostname validation
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<T>((res) => { t = setTimeout(() => res(fallback), ms); });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}

async function resolveIps(domain: string): Promise<string[]> {
  const out = new Set<string>();
  for (const host of [domain, `www.${domain}`]) {
    // Timeout-protected so a slow/missing resolver can never stall the check.
    const a = await withTimeout(
      dns.resolve4(host).catch(() => [] as string[]),
      4000,
      [] as string[]
    );
    a.forEach((ip) => out.add(ip));
  }
  return [...out].slice(0, 8);
}

async function certSubdomains(domain: string): Promise<string[]> {
  try {
    const res = await withTimeout(
      fetch(`https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`, {
        headers: { "User-Agent": "PRET-ExposureCheck/1.0" },
      }),
      8000,
      null as any
    );
    if (!res || !res.ok) return [];
    const data = (await res.json()) as Array<{ name_value?: string }>;
    const set = new Set<string>();
    for (const row of data) {
      for (const name of (row.name_value ?? "").split(/\n/)) {
        const n = name.trim().toLowerCase().replace(/^\*\./, "");
        if (n.endsWith(domain) && n !== domain) set.add(n);
      }
    }
    return [...set].sort().slice(0, 100);
  } catch {
    return [];
  }
}

interface ShodanHost {
  ports?: number[];
  vulns?: string[];
  data?: Array<{ port?: number; product?: string; _shodan?: any; data?: string; http?: { server?: string } }>;
}

async function shodanHost(ip: string, key: string): Promise<ShodanHost | null> {
  try {
    const res = await withTimeout(
      fetch(`https://api.shodan.io/shodan/host/${ip}?key=${encodeURIComponent(key)}&minify=false`),
      8000,
      null as any
    );
    if (!res || !res.ok) return null;
    return (await res.json()) as ShodanHost;
  } catch {
    return null;
  }
}

function sevForPort(port: number): Severity {
  if (port === 23) return "CRITICAL";
  if (port === 21 || port === 9100) return "HIGH";
  if (port === 515 || port === 80) return "MEDIUM";
  return "LOW";
}

export async function externalCheck(rawDomain: string, shodanKey?: string): Promise<ReconResult | null> {
  const domain = normalizeDomain(rawDomain);
  if (!domain) return null;

  const findings: ExposureFinding[] = [];
  const notes: string[] = [];

  const [ips, subs] = await Promise.all([resolveIps(domain), certSubdomains(domain)]);

  const printerSubs = subs.filter((s) => PRINTER_SUBDOMAIN_HINTS.some((h) => s.includes(h)));
  for (const s of printerSubs) {
    findings.push({
      severity: "LOW",
      title: `Printer-related hostname published: ${s}`,
      detail: "A device-looking hostname appears in certificate transparency logs. If it resolves publicly, it may be reachable from the internet.",
      source: "Certificate Transparency",
    });
  }

  let shodanUsed = false;
  if (shodanKey && ips.length) {
    for (const ip of ips.slice(0, 5)) {
      const host = await shodanHost(ip, shodanKey);
      if (!host) continue;
      shodanUsed = true;
      const ports = host.ports ?? [];
      const printerPorts = ports.filter((p) => PRINTER_PORTS.includes(p));
      for (const p of printerPorts) {
        const svc = (host.data ?? []).find((d) => d.port === p);
        const banner = (svc?.product || svc?.http?.server || "").toString();
        const looksPrinter = PRINTER_HINTS.some((h) => banner.toLowerCase().includes(h)) || [9100, 515, 631].includes(p);
        findings.push({
          severity: looksPrinter ? sevForPort(p) : "LOW",
          title: `${ip}:${p} exposed to the internet${banner ? ` (${banner})` : ""}`,
          detail: p === 9100 ? "Raw/JetDirect printing port reachable from the internet — accepts unauthenticated print and control commands." :
            p === 631 ? "IPP printing reachable from the internet." :
            p === 161 ? "SNMP reachable from the internet — often exposes device config via default community strings." :
            p === 23 ? "Telnet reachable from the internet — cleartext remote management." :
            `Service on port ${p} reachable from the internet.`,
          source: "Shodan",
        });
      }
      for (const v of host.vulns ?? []) {
        findings.push({
          severity: "HIGH",
          title: `Known vulnerability indexed on ${ip}: ${v}`,
          detail: "Shodan has flagged this host against a known CVE. Verify and patch.",
          source: "Shodan",
        });
      }
    }
    if (!shodanUsed) notes.push("No hosts for this domain are indexed in Shodan's scan data (often a good sign).");
  } else if (!shodanKey) {
    notes.push("Live internet-scan lookup (Shodan) is not configured; results are limited to DNS and certificate transparency.");
  }

  const exposed = findings.some((f) => f.severity === "HIGH" || f.severity === "CRITICAL" || f.source === "Shodan");

  return { domain, ips, subdomains: subs, printerSubdomains: printerSubs, findings, exposed, shodanUsed, notes };
}

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
