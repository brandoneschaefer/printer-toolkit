import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CollectorManager } from "@/components/CollectorManager";
import { GuideGenerator } from "@/components/GuideGenerator";
import { deleteCollectorAction } from "@/lib/actions/collectors";
import { dateTime } from "@/lib/format";
import { Trash2, Server } from "lucide-react";

function isOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

export default async function CollectorsPage() {
  const { org, session } = await requireTenant();
  const collectors = await prisma.collector.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Collectors</h1>
        <p className="text-sm text-slate-400">
          On-prem scan agents that let PRET reach printers inside private networks without exposing them.
        </p>
      </div>

      <CollectorManager
        appUrl={env.appUrl}
        image={env.collectorImage}
        installerUrl={env.collectorInstallerUrl}
        userInstallerUrl={env.collectorUserInstallerUrl}
        applianceUrl={env.collectorApplianceUrl}
        usbBuilderUrl={env.collectorUsbBuilderUrl}
      />

      <GuideGenerator defaultContact={session.email} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Registered collectors ({collectors.length})</h2>
        {collectors.length === 0 ? (
          <div className="card text-sm text-slate-400">
            No collectors yet. Register one above to scan internal printer fleets.
          </div>
        ) : (
          <div className="space-y-2">
            {collectors.map((c) => {
              const online = isOnline(c.lastSeenAt);
              return (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-brand-300" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{c.name}</span>
                        {online ? (
                          <span className="badge bg-emerald-500/20 text-emerald-300">Online</span>
                        ) : (
                          <span className="badge bg-slate-500/20 text-slate-400">Offline</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Last seen {c.lastSeenAt ? dateTime(c.lastSeenAt) : "never"} · id <code>{c.id}</code>
                      </div>
                    </div>
                  </div>
                  <form action={deleteCollectorAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn-ghost text-xs text-red-300 hover:bg-red-500/10" type="submit">
                      <Trash2 className="h-4 w-4" /> Revoke
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
