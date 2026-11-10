// Shared report helpers used by the interactive report and the PDF/print view.

export const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export interface FindingLike {
  host: string;
  severity: string;
  port?: number | null;
  protocol?: string | null;
}

export interface HostFindingGroup<T extends FindingLike> {
  host: string;
  findings: T[];
  worst: number; // index into SEV_ORDER (0 = CRITICAL)
}

/** Group findings by host, worst-affected host first, findings sorted by severity. */
export function groupFindingsByHost<T extends FindingLike>(findings: T[]): HostFindingGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const f of findings) {
    const arr = map.get(f.host);
    if (arr) arr.push(f);
    else map.set(f.host, [f]);
  }
  const groups = [...map.entries()].map(([host, fs]) => ({
    host,
    findings: [...fs].sort((a, b) => SEV_ORDER.indexOf(a.severity as any) - SEV_ORDER.indexOf(b.severity as any)),
    worst: Math.min(...fs.map((f) => SEV_ORDER.indexOf(f.severity as any))),
  }));
  groups.sort((a, b) => a.worst - b.worst || b.findings.length - a.findings.length);
  return groups;
}
