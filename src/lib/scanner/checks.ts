import type { RawFinding, Severity } from "./types";

// Printer-relevant ports probed during an audit.
export const PRINTER_PORTS: Array<{ port: number; proto: string; readBanner: boolean }> = [
  { port: 21, proto: "FTP", readBanner: true },
  { port: 23, proto: "TELNET", readBanner: true },
  { port: 80, proto: "HTTP", readBanner: false },
  { port: 443, proto: "HTTPS", readBanner: false },
  { port: 515, proto: "LPD", readBanner: false },
  { port: 631, proto: "IPP", readBanner: false },
  { port: 9100, proto: "RAW", readBanner: false },
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  INFO: 0,
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

// Catalog of recommendation text, grounded in standard printer hardening.
export const CHECK_CATALOG: Record<
  string,
  { title: string; severity: Severity; description: string; recommendation: string }
> = {
  "telnet-enabled": {
    title: "Telnet remote management enabled",
    severity: "CRITICAL",
    description:
      "The device accepts Telnet connections. Telnet transmits credentials and management traffic in cleartext and is trivially intercepted on the local network.",
    recommendation:
      "Disable Telnet entirely. Use HTTPS or SSH-based management only. If remote CLI access is required, restrict it to an isolated management VLAN.",
  },
  "ftp-enabled": {
    title: "FTP service enabled",
    severity: "HIGH",
    description:
      "The device exposes an FTP service. Legacy printer FTP is commonly unauthenticated or uses default credentials and transmits data in cleartext.",
    recommendation:
      "Disable FTP if not required. If firmware updates depend on it, restrict access to trusted management hosts and prefer an encrypted transport.",
  },
  "raw-9100-open": {
    title: "Raw/JetDirect printing (port 9100) exposed",
    severity: "MEDIUM",
    description:
      "Port 9100 (RAW/JetDirect) is open. It accepts unauthenticated print jobs and printer control-language commands (PJL/PCL/PostScript) from any host that can reach it.",
    recommendation:
      "Restrict port 9100 to authorized print servers via firewall/ACL, place the printer on an isolated VLAN, and disable raw printing if IPP/IPPS is used instead.",
  },
  "pjl-unauthenticated": {
    title: "Unauthenticated PJL access and information disclosure",
    severity: "HIGH",
    description:
      "The device responded to unauthenticated PJL INFO queries over port 9100, disclosing device identity/status. The same unauthenticated channel exposes PJL job and configuration control.",
    recommendation:
      "Lock down port 9100 to trusted print servers, enable a PJL/device access password where supported, and disable unused PJL functionality. Treat the raw port as an administrative interface.",
  },
  "lpd-enabled": {
    title: "Legacy LPD printing (port 515) enabled",
    severity: "LOW",
    description:
      "The Line Printer Daemon (LPD, port 515) is enabled. LPD is a legacy cleartext protocol with weak host-based access control.",
    recommendation:
      "Disable LPD/515 if modern IPP/IPPS printing is in use. If required, restrict it to trusted print servers.",
  },
  "ipp-open": {
    title: "IPP service reachable",
    severity: "INFO",
    description:
      "The Internet Printing Protocol (IPP, port 631) is reachable. IPP is acceptable when delivered over TLS (IPPS) with authentication.",
    recommendation:
      "Ensure IPP is served over TLS (IPPS/443 or ipps://) and requires authentication. Disable plaintext IPP if not needed.",
  },
  "http-admin-plaintext": {
    title: "Web administration over unencrypted HTTP",
    severity: "MEDIUM",
    description:
      "The embedded web management interface is served over plaintext HTTP. Administrative credentials and configuration are exposed to network eavesdroppers.",
    recommendation:
      "Disable HTTP and serve the management UI over HTTPS only. Redirect port 80 to 443 and install a valid certificate.",
  },
  "http-admin-noauth": {
    title: "Web administration interface requires no authentication",
    severity: "HIGH",
    description:
      "The management interface returned a successful response without requesting any authentication, suggesting administrative functions may be accessible without a login.",
    recommendation:
      "Enable authentication on the web management interface and set a strong unique administrator password. Restrict access to a management network.",
  },
  "http-default-credentials": {
    title: "Default administrator credentials accepted",
    severity: "CRITICAL",
    description:
      "The web management interface accepted well-known default credentials. An attacker can take full administrative control of the device, redirect jobs, exfiltrate stored documents, or pivot into the network.",
    recommendation:
      "Immediately change the administrator password to a strong unique value, rotate any SNMP/community secrets, and review the device for unauthorized configuration changes.",
  },
  "snmp-default-community": {
    title: "SNMP default community string accepted",
    severity: "HIGH",
    description:
      "The device responded to SNMP queries using a manufacturer-default community string. This exposes device configuration and, with a writable community, allows remote reconfiguration. SNMP v1/v2c also transmits in cleartext.",
    recommendation:
      "Change SNMP community strings to strong unique values, prefer SNMPv3 with authentication and encryption, and disable SNMP entirely if unused. Restrict UDP/161 to monitoring hosts.",
  },
  "tls-weak": {
    title: "Management TLS endpoint present",
    severity: "INFO",
    description:
      "An HTTPS management endpoint is present. Verify the certificate is valid, not expired, and not using a weak/self-signed default.",
    recommendation:
      "Install a valid certificate from your internal CA, disable TLS 1.0/1.1, and enforce strong cipher suites.",
  },
};

export function makeFinding(
  checkId: string,
  host: string,
  opts: { port?: number; protocol?: string; evidence?: string; severityOverride?: Severity } = {}
): RawFinding {
  const def = CHECK_CATALOG[checkId];
  if (!def) {
    return {
      host,
      checkId,
      title: checkId,
      severity: "INFO",
      description: "Unknown check.",
      recommendation: "",
      ...opts,
    };
  }
  return {
    host,
    port: opts.port,
    protocol: opts.protocol,
    checkId,
    title: def.title,
    severity: opts.severityOverride ?? def.severity,
    description: def.description,
    recommendation: def.recommendation,
    evidence: opts.evidence,
  };
}

/** 0-100 risk score from a set of findings (saturating). */
export function riskScore(findings: RawFinding[]): number {
  const raw = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  // Saturate so a handful of criticals maxes the meter.
  return Math.min(100, raw);
}

export function severityCounts(findings: RawFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}
