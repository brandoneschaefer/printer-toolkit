export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RawFinding {
  host: string;
  port?: number;
  protocol?: string;
  checkId: string;
  title: string;
  severity: Severity;
  description: string;
  evidence?: string;
  recommendation: string;
}

export interface PortResult {
  port: number;
  open: boolean;
  banner?: string;
}

export interface HostResult {
  address: string;
  hostname?: string;
  online: boolean;
  openPorts: number[];
  vendor?: string;
  model?: string;
  deviceType?: string;
  ports: PortResult[];
  findings: RawFinding[];
}

export interface ScanOptions {
  tcpTimeoutMs: number;
  // When false, intrusive-but-still-read-only probes (PJL INFO, SNMP, default
  // credential checks) are skipped and only port/protocol exposure is reported.
  activeProbes: boolean;
}

export interface ScanResult {
  hosts: HostResult[];
  startedAt: Date;
  completedAt: Date;
}
