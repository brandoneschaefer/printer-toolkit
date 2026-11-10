import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { AddTargetForm } from "@/components/AddTargetForm";
import { deleteTargetAction, toggleAuthorizedAction } from "@/lib/actions/targets";
import { Trash2, ShieldCheck, ShieldX } from "lucide-react";

export default async function TargetsPage() {
  const { org } = await requireTenant();
  const targets = await prisma.target.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Targets &amp; scope</h1>
        <p className="text-sm text-slate-400">
          Register the hosts and ranges you are authorized to audit. Only authorized targets can be scanned.
        </p>
      </div>

      <AddTargetForm />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Your targets ({targets.length})</h2>
        {targets.length === 0 ? (
          <div className="card text-sm text-slate-400">No targets yet. Add one above to get started.</div>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => (
              <div key={t.id} className="card flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{t.label}</span>
                    {t.authorized ? (
                      <span className="badge bg-emerald-500/20 text-emerald-300">Authorized</span>
                    ) : (
                      <span className="badge bg-amber-500/20 text-amber-300">Not authorized</span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-sm text-slate-400">{t.value}</div>
                  {t.notes && <div className="mt-1 text-xs text-slate-500">{t.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleAuthorizedAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn-ghost text-xs" type="submit">
                      {t.authorized ? <><ShieldX className="h-4 w-4" /> Revoke</> : <><ShieldCheck className="h-4 w-4" /> Authorize</>}
                    </button>
                  </form>
                  <form action={deleteTargetAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn-ghost text-xs text-red-300 hover:bg-red-500/10" type="submit">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
