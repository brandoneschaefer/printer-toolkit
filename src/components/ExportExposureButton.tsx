"use client";

import { Download } from "lucide-react";
import type { ReconResult } from "@/lib/recon";

export function ExportExposureButton({ result }: { result: ReconResult }) {
  const download = () => {
    const lines: string[] = [];
    lines.push("domain,verdict,public_ips,subdomains,printer_hostnames");
    lines.push(
      `${result.domain},${result.exposed ? "exposed" : "clean"},${result.ips.length},${result.subdomains.length},${result.printerSubdomains.length}`
    );
    lines.push("");
    lines.push("severity,title,source,what_it_means,how_to_fix");
    for (const f of result.findings) {
      const esc = (s: string) => `"${(s ?? "").replace(/"/g, "'")}"`;
      lines.push(`${f.severity},${esc(f.title)},${esc(f.source)},${esc(f.detail)},${esc(f.recommendation)}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exposure-${result.domain}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={download} className="btn-ghost text-xs">
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
