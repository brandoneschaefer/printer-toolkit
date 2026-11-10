"use client";

import { Download } from "lucide-react";

interface Row { domain: string; exposed: boolean; ips: number; subdomains: number; findings: number; top: string | null; shareToken?: string | null }

export function ExportBulkButton({ rows, filename }: { rows: Row[]; filename: string }) {
  const download = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const header = "domain,status,public_ips,subdomains,findings,top_finding,report_link\n";
    const body = rows
      .map((r) => `${r.domain},${r.exposed ? "exposed" : "clean"},${r.ips},${r.subdomains},${r.findings},"${(r.top ?? "").replace(/"/g, "'")}",${r.shareToken ? `${origin}/exposure/${r.shareToken}` : ""}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} className="btn-ghost text-xs">
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
