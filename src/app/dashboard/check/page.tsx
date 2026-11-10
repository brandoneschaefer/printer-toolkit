import { requireTenant } from "@/lib/tenant";
import { DomainCheckForm } from "@/components/DomainCheckForm";
import { BulkCheckForm } from "@/components/BulkCheckForm";

export default async function OperatorCheckPage() {
  await requireTenant();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Exposure check</h1>
        <p className="text-sm text-slate-400">
          Research a prospect&apos;s external exposure by domain — no email, nothing logged. Great before a sales call.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Single domain</h2>
        <DomainCheckForm />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Bulk check (CSV)</h2>
        <BulkCheckForm />
      </div>
    </div>
  );
}
