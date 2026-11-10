export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`badge sev-${severity}`}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED: "bg-slate-500/20 text-slate-300",
    RUNNING: "bg-brand-500/20 text-brand-300",
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    FAILED: "bg-red-500/20 text-red-300",
  };
  return <span className={`badge ${map[status] ?? "bg-slate-500/20 text-slate-300"}`}>{status}</span>;
}

export function RiskMeter({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : score >= 15 ? "bg-amber-500" : "bg-emerald-500";
  const label =
    score >= 70 ? "Critical" : score >= 40 ? "Elevated" : score >= 15 ? "Moderate" : "Low";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-sm text-slate-400">{label} risk</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
    </div>
  );
}
