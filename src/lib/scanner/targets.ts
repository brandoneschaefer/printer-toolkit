// Parse and expand tenant-supplied scope strings into a concrete host list.
// Supports: single IPv4, hostname, and IPv4 CIDR (/24../32). IPv6 and
// hostname-wildcards are intentionally not expanded.

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function ipToInt(a: number, b: number, c: number, d: number): number {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function validOctets(parts: string[]): number[] | null {
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

export interface ExpandResult {
  hosts: string[];
  errors: string[];
}

/**
 * Expand a list of scope entries into unique hosts, enforcing a hard cap.
 * Oversized scopes are rejected (not silently truncated) so the operator
 * always knows the full requested range was covered.
 */
export function expandScope(entries: string[], maxHosts: number): ExpandResult {
  const hosts = new Set<string>();
  const errors: string[] = [];

  for (const raw of entries) {
    const entry = raw.trim();
    if (!entry) continue;

    const cidr = entry.match(CIDR_RE);
    if (cidr) {
      const octets = validOctets(cidr.slice(1, 5));
      const bits = Number.parseInt(cidr[5], 10);
      if (!octets || bits < 0 || bits > 32) {
        errors.push(`Invalid CIDR: ${entry}`);
        continue;
      }
      if (bits < 20) {
        errors.push(`CIDR too large (min /20): ${entry}`);
        continue;
      }
      const base = ipToInt(octets[0], octets[1], octets[2], octets[3]) & (bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0);
      const count = bits === 32 ? 1 : Math.pow(2, 32 - bits);
      // For /31 and /32 use all addresses; otherwise skip network & broadcast.
      const start = bits <= 30 ? 1 : 0;
      const end = bits <= 30 ? count - 1 : count;
      for (let i = start; i < end; i++) {
        hosts.add(intToIp(base + i));
        if (hosts.size > maxHosts) {
          return { hosts: [], errors: [`Scope exceeds max of ${maxHosts} hosts`] };
        }
      }
      continue;
    }

    const ip = entry.match(IPV4_RE);
    if (ip) {
      const octets = validOctets(ip.slice(1, 5));
      if (!octets) {
        errors.push(`Invalid IPv4: ${entry}`);
        continue;
      }
      hosts.add(entry);
      continue;
    }

    if (HOSTNAME_RE.test(entry)) {
      hosts.add(entry.toLowerCase());
      continue;
    }

    errors.push(`Unrecognized scope entry: ${entry}`);
  }

  if (hosts.size > maxHosts) {
    return { hosts: [], errors: [`Scope exceeds max of ${maxHosts} hosts`] };
  }

  return { hosts: [...hosts], errors };
}
