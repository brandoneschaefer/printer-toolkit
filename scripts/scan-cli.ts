// Standalone scanner CLI — run the assessment engine against a host without
// the web app or a database. For development/testing only.
//
//   npx tsx scripts/scan-cli.ts <host-or-cidr> [--passive]
//
// Only scan hosts you are authorized to test.

import { runScan } from "../src/lib/scanner";
import { expandScope } from "../src/lib/scanner/targets";
import { riskScore, severityCounts } from "../src/lib/scanner/checks";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/scan-cli.ts <host-or-cidr> [--passive]");
    process.exit(1);
  }
  const activeProbes = !process.argv.includes("--passive");
  const { hosts, errors } = expandScope([arg], 256);
  if (errors.length) console.error("Scope warnings:", errors.join("; "));
  if (!hosts.length) {
    console.error("No hosts to scan.");
    process.exit(1);
  }

  console.log(`Scanning ${hosts.length} host(s), activeProbes=${activeProbes}...\n`);
  const result = await runScan(hosts, { tcpTimeoutMs: 2500, activeProbes });

  for (const h of result.hosts) {
    console.log(`== ${h.address} ${h.online ? "(online)" : "(no response)"} ${h.vendor ? `[${h.vendor}]` : ""}`);
    console.log(`   open ports: ${h.openPorts.join(", ") || "none"}`);
    for (const f of h.findings) {
      console.log(`   [${f.severity}] ${f.title}${f.port ? ` :${f.port}` : ""}`);
      if (f.evidence) console.log(`        evidence: ${f.evidence.replace(/\s+/g, " ").slice(0, 120)}`);
    }
    console.log();
  }

  const all = result.hosts.flatMap((h) => h.findings);
  console.log("Severity counts:", severityCounts(all));
  console.log("Risk score:", riskScore(all));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
