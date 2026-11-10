import { requireTenant } from "@/lib/tenant";
import { DomainCheckForm } from "@/components/DomainCheckForm";

export default async function OperatorCheckPage() {
  await requireTenant();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exposure check</h1>
        <p className="text-sm text-slate-400">
          Research a prospect&apos;s external exposure by domain — no email, nothing logged. Great before a sales call.
        </p>
      </div>
      <DomainCheckForm />
    </div>
  );
}
