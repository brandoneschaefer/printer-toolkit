"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Host {
  id: string;
  address: string;
  online: boolean;
  vendor?: string | null;
  openPorts: number[];
}

export function HostTable({ hosts }: { hosts: Host[] }) {
  const [showQuiet, setShowQuiet] = useState(false);
  const responding = hosts.filter((h) => h.online);
  const quiet = hosts.filter((h) => !h.online);
  const shown = showQuiet ? hosts : responding;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Vendor</th>
            <th className="px-4 py-3">Open ports</th>
          </tr>
        </thead>
        <tbody>
          {responding.length === 0 && !showQuiet && (
            <tr><td colSpan={4} className="px-4 py-3 text-slate-400">No hosts responded.</td></tr>
          )}
          {shown.map((h) => (
            <tr key={h.id} className="border-t border-white/5">
              <td className="px-4 py-3 font-mono text-slate-200">{h.address}</td>
              <td className="px-4 py-3">
                {h.online ? (
                  <span className="badge bg-emerald-500/20 text-emerald-300">Online</span>
                ) : (
                  <span className="badge bg-slate-500/20 text-slate-400">No response</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">{h.vendor ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{h.openPorts.length ? h.openPorts.join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {quiet.length > 0 && (
        <button
          type="button"
          onClick={() => setShowQuiet((v) => !v)}
          className="flex w-full items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          {showQuiet ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {showQuiet ? "Hide" : "Show"} {quiet.length} non-responding address{quiet.length === 1 ? "" : "es"}
        </button>
      )}
    </div>
  );
}
