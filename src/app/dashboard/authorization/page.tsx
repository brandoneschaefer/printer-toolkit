import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { AuthorizationForm } from "@/components/AuthorizationForm";
import { revokeAuthorizationAction } from "@/lib/actions/authorization";
import { authorizationStatement } from "@/lib/authorization-text";
import { dateTime } from "@/lib/format";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default async function AuthorizationPage() {
  const { org, session } = await requireTenant();
  const active = await prisma.authorization.findFirst({
    where: { orgId: org.id, active: true },
    orderBy: { signedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Authorization</h1>
        <p className="text-sm text-slate-400">
          Record who authorized security testing and the scope they authorized. Required before any audit runs.
        </p>
      </div>

      {active ? (
        <div className="card border-emerald-400/30 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Authorization on file</span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Authorized by</dt><dd className="text-slate-200">{active.signerName}{active.signerTitle ? `, ${active.signerTitle}` : ""}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="text-slate-200">{active.signerEmail}</dd></div>
            <div><dt className="text-slate-500">Signed</dt><dd className="text-slate-200">{dateTime(active.signedAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Scope</dt><dd className="text-slate-200">{active.scope}</dd></div>
          </dl>
          <form action={revokeAuthorizationAction} className="mt-4">
            <input type="hidden" name="id" value={active.id} />
            <button className="btn-ghost text-xs text-red-300 hover:bg-red-500/10" type="submit">Revoke authorization</button>
          </form>
        </div>
      ) : (
        <div className="card border-amber-400/30 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-amber-300">No authorization on file</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">Audits are blocked until a signed authorization is recorded below.</p>
        </div>
      )}

      <AuthorizationForm statement={authorizationStatement(org.name)} defaultEmail={session.email} />
    </div>
  );
}
