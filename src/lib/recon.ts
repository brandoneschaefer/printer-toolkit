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
  detail: string; // plain-language "what this means"
  recommendation: string; // best-practice fix
  source: string; // "Shodan", "Certificate Transparency", "DNS"
}

function portRecommendation(p: number): string {
  switch (p) {
    case 9100:
      return "Block port 9100 from the internet at your firewall. This raw printing port should only be reachable from internal print servers — never the public internet. Disable raw printing if you use IPP/IPPS.";
    case 631:
      return "Restrict IPP (631) to your internal network. If remote printing is required, use IPPS (TLS) with authentication and a VPN, not direct internet exposure.";
    case 515:
      return "Disable LPD (515) or restrict it to internal print servers. It is a legacy cleartext protocol that should never face the internet.";
    case 161:
      return "Block SNMP (UDP 161) from the internet, change the default community strings, and prefer SNMPv3 with authentication. SNMP leaks device configuration.";
    case 23:
      return "Disable Telnet and block port 23 everywhere. Telnet sends credentials in cleartext. Manage the device over HTTPS or SSH on the internal network only.";
    case 21:
      return "Disable FTP (21) or restrict it to trusted internal hosts. Printer FTP is often unauthenticated and cleartext.";
    case 80:
      return "Do not expose the printer's web admin to the internet. Block port 80 at the firewall, serve management over HTTPS internally only, and set a strong admin password.";
    case 443:
      return "Even over HTTPS, printer/MFP management should not be internet-facing. Restrict it to your internal network or VPN and require a strong admin login.";
    default:
      return "Restrict this service to your internal network at the firewall. Printers and copiers should never be directly reachable from the internet.";
  }
}

function portMeaning(p: number): string {
  switch (p) {
    case 9100:
      return "Anyone on the internet can send raw print jobs and printer control commands (PJL/PCL/PostScript) to this device without logging in — including commands that read device info or manipulate jobs.";
    case 631:
      return "The device's printing service is reachable from the internet. If it isn't using TLS and authentication, print jobs and settings can be intercepted or abused.";
    case 515:
      return "A legacy line-printer service is reachable from the internet. It has weak, host-based access control and sends data in the clear.";
    case 161:
      return "The device answers network management queries from the internet. With a default community string, that exposes its configuration and can allow remote changes.";
    case 23:
      return "A cleartext remote-login service is reachable from the internet. Credentials and commands can be read by anyone watching the connection.";
    case 21:
      return "A file-transfer service is reachable from the internet. On printers this is frequently unauthenticated and unencrypted.";
    case 80:
      return "The device's web admin console is reachable from the internet over unencrypted HTTP, so the admin password and settings can be captured in transit.";
    case 443:
      return "The device's web admin console is reachable from the internet. Management interfaces should not be internet-facing even when encrypted.";
    default:
      return "This service is reachable from the internet and should normally be restricted to the internal network.";
  }
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
      detail: "A printer/device-looking hostname appears in public certificate-transparency logs. If it resolves publicly, the device behind it may be reachable from the internet.",
      recommendation: "Check whether this hostname points to a printer/MFP and whether it needs to be public. If it's a device, remove the public DNS record and keep it on the internal network behind the firewall/VPN.",
      source: "Certificate Transparency",
    });
  }

  // Data source: full Shodan host API (richer) when a key is set, otherwise the
  // free, keyless Shodan InternetDB. Both give open ports + CVEs per IP.
  // Shown generically on the page so vendor names aren't surfaced to prospects.
  const sourceLabel = "Internet scan";
  let scanUsed = false;

  if (ips.length) {
    for (const ip of ips.slice(0, 5)) {
      const host = shodanKey ? normalizeShodan(await shodanHost(ip, shodanKey)) : normalizeInternetDb(await internetdbHost(ip));
      if (!host) continue;
      scanUsed = true;
      const hints = host.hints.map((h) => h.toLowerCase());
      // Does anything about this host indicate it's actually a printer/MFP?
      const hostPrinterSignal = PRINTER_HINTS.some((h) => hints.some((x) => x.includes(h)));
      // Printing protocols are strong printer signals on their own.
      const PRINTING_PROTOCOLS = [9100, 515, 631];
      const hasPrintingProtocol = host.ports.some((pp) => PRINTING_PROTOCOLS.includes(pp));

      for (const p of host.ports.filter((pp) => PRINTER_PORTS.includes(pp))) {
        const banner = host.banners[p] || "";
        const portPrinterSignal = PRINTER_HINTS.some((h) => banner.toLowerCase().includes(h)) || hostPrinterSignal;
        const isPrintingProtocol = PRINTING_PROTOCOLS.includes(p);
        // Generic services (SNMP/Telnet/FTP/HTTP/HTTPS) are only reported when
        // there is a printer signal — otherwise they're just the company's web
        // servers / network gear, not printer exposure.
        if (!isPrintingProtocol && !portPrinterSignal) continue;
        findings.push({
          severity: sevForPort(p),
          title: `${ip}:${p} exposed to the internet${banner ? ` (${banner})` : ""}`,
          detail: portMeaning(p),
          recommendation: portRecommendation(p),
          source: sourceLabel,
        });
      }

      // CVEs only when this host is actually a printer (printing protocol or a
      // printer signal) — keeps the report strictly printer-focused.
      if (hasPrintingProtocol || hostPrinterSignal) {
        for (const v of host.vulns) {
          findings.push({
            severity: "HIGH",
            title: `Known vulnerability indexed on ${ip}: ${v}`,
            detail: "This internet-facing printer/MFP is flagged against a published security vulnerability (CVE) in internet-scan data.",
            recommendation: "Update the device firmware to the latest version from the manufacturer's security page — these CVEs are almost always fixed by a firmware update. Then confirm the device is no longer internet-facing.",
            source: sourceLabel,
          });
        }
      }
    }
    if (!scanUsed) notes.push("No internet-facing services were found for this domain (often a good sign).");
  }

  const exposed = findings.some((f) => f.source === sourceLabel);

  return { domain, ips, subdomains: subs, printerSubdomains: printerSubs, findings, exposed, shodanUsed: scanUsed, notes };
}

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
