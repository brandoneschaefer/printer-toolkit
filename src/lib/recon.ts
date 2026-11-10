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
import { PRINTER_VENDOR_KEYWORDS } from "./scanner/vendors";

const PRINTER_PORTS = [9100, 515, 631, 161, 23, 21, 80, 443];
const PRINTER_HINTS = [
  "jetdirect", "pjl", "ipp", "cups", "printer", "chaiserver", "web image monitor",
  ...PRINTER_VENDOR_KEYWORDS,
];
const PRINTER_SUBDOMAIN_HINTS = ["print", "printer", "mfp", "copier", "copy", "scan", "scanner", "jetdirect", "bizhub", "ricoh", "xerox"];

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

function portDetail(p: number): string {
  if (p === 9100) return "Raw/JetDirect printing port reachable from the internet — accepts unauthenticated print and control commands.";
  if (p === 631) return "IPP printing reachable from the internet.";
  if (p === 515) return "Legacy LPD printing reachable from the internet.";
  if (p === 161) return "SNMP reachable from the internet — often exposes device config via default community strings.";
  if (p === 23) return "Telnet reachable from the internet — cleartext remote management.";
  if (p === 21) return "FTP reachable from the internet — often cleartext / default credentials.";
  if (p === 80) return "Web management interface reachable over unencrypted HTTP from the internet.";
  return `Service on port ${p} reachable from the internet.`;
}

// Shodan InternetDB: free, keyless summary per IP (ports, CPEs, hostnames,
// tags, CVEs). https://internetdb.shodan.io/<ip>
interface InternetDbHost {
  ports?: number[];
  cpes?: string[];
  hostnames?: string[];
  tags?: string[];
  vulns?: string[];
}

async function internetdbHost(ip: string): Promise<InternetDbHost | null> {
  try {
    const res = await withTimeout(
      fetch(`https://internetdb.shodan.io/${ip}`, { headers: { "User-Agent": "PRET-ExposureCheck/1.0" } }),
      6000,
      null as any
    );
    if (!res || !res.ok) return null; // 404 = no data for this IP
    return (await res.json()) as InternetDbHost;
  } catch {
    return null;
  }
}

interface NormHost {
  ports: number[];
  vulns: string[];
  banners: Record<number, string>;
  hints: string[];
}

function normalizeShodan(h: ShodanHost | null): NormHost | null {
  if (!h) return null;
  const banners: Record<number, string> = {};
  for (const d of h.data ?? []) {
    if (d.port) {
      const b = (d.product || d.http?.server || "").toString();
      if (b) banners[d.port] = b;
    }
  }
  return { ports: h.ports ?? [], vulns: h.vulns ?? [], banners, hints: Object.values(banners) };
}

function normalizeInternetDb(h: InternetDbHost | null): NormHost | null {
  if (!h) return null;
  return {
    ports: h.ports ?? [],
    vulns: h.vulns ?? [],
    banners: {},
    hints: [...(h.cpes ?? []), ...(h.tags ?? []), ...(h.hostnames ?? [])],
  };
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

  // Data source: full Shodan host API (richer) when a key is set, otherwise the
  // free, keyless Shodan InternetDB. Both give open ports + CVEs per IP.
  const sourceLabel = shodanKey ? "Shodan" : "Shodan InternetDB";
  let scanUsed = false;

  if (ips.length) {
    for (const ip of ips.slice(0, 5)) {
      const host = shodanKey ? normalizeShodan(await shodanHost(ip, shodanKey)) : normalizeInternetDb(await internetdbHost(ip));
      if (!host) continue;
      scanUsed = true;
      const hints = host.hints.map((h) => h.toLowerCase());
      const printerPorts = host.ports.filter((pp) => PRINTER_PORTS.includes(pp));
      for (const p of printerPorts) {
        const banner = host.banners[p] || "";
        const looksPrinter =
          [9100, 515, 631].includes(p) ||
          PRINTER_HINTS.some((h) => banner.toLowerCase().includes(h) || hints.some((x) => x.includes(h)));
        findings.push({
          severity: looksPrinter ? sevForPort(p) : "LOW",
          title: `${ip}:${p} exposed to the internet${banner ? ` (${banner})` : ""}`,
          detail: portDetail(p),
          source: sourceLabel,
        });
      }
      // CVEs only when this host actually exposes a printer-relevant port —
      // keeps the report strictly printer-focused.
      if (printerPorts.length > 0) {
        for (const v of host.vulns) {
          findings.push({
            severity: "HIGH",
            title: `Known vulnerability indexed on ${ip}: ${v}`,
            detail: "This printer-exposing host is flagged against a known CVE in internet-scan data. Verify and patch.",
            source: sourceLabel,
          });
        }
      }
    }
    if (!scanUsed) notes.push(`No hosts for this domain are indexed in ${sourceLabel} (often a good sign).`);
  }
  if (!shodanKey) notes.push("Using Shodan InternetDB (free). Add a Shodan API key for richer per-service detail.");

  const exposed = findings.some((f) => f.source === "Shodan" || f.source === "Shodan InternetDB");

  return { domain, ips, subdomains: subs, printerSubdomains: printerSubs, findings, exposed, shodanUsed: scanUsed, notes };
}

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
