"use client";

import { useActionState, useState } from "react";
import { Copy, Check } from "lucide-react";
import { createCollectorAction, type CollectorActionState } from "@/lib/actions/collectors";

const initial: CollectorActionState = {};

export function CollectorManager({ appUrl, image }: { appUrl: string; image: string }) {
  const [state, formAction, pending] = useActionState(createCollectorAction, initial);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4">
        <h2 className="font-semibold text-white">Register a collector</h2>
        <p className="text-sm text-slate-400">
          Install a collector inside the network you want to audit. It pulls jobs from SentinelPrint and runs the
          scan locally, so printers on private VLANs never need to be exposed to the internet.
        </p>
        <div className="flex gap-3">
          <input name="name" className="input" placeholder="HQ datacenter collector" required />
          <button className="btn-primary shrink-0" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
        {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      </form>

      {state.ok && state.token && (
        <div className="card border-emerald-400/30 bg-emerald-500/5 space-y-3">
          <h3 className="font-semibold text-emerald-300">Collector “{state.name}” created</h3>
          <p className="text-sm text-slate-300">
            Copy this token now — it is shown <strong>only once</strong> and cannot be retrieved later.
          </p>
          <TokenRow label="Collector token" value={state.token} copied={copied === "tok"} onCopy={() => copy(state.token!, "tok")} />
          <div className="rounded-lg border border-white/10 bg-ink-900 p-3 text-xs text-slate-400">
            <div className="mb-2 font-semibold text-slate-300">Run the collector on any always-on machine inside the target network (Docker):</div>
            <pre className="overflow-x-auto whitespace-pre-wrap">{`docker run -d --name sentinel-collector --restart unless-stopped --network host \\
  -e SENTINEL_URL=${appUrl} \\
  -e COLLECTOR_TOKEN=${state.token} \\
  ${image}`}</pre>
            <div className="mt-2 text-slate-500">
              Outbound HTTPS only — no inbound ports. It will appear as “Online” here within a minute.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs text-slate-200">
          {value}
        </code>
        <button type="button" onClick={onCopy} className="btn-ghost shrink-0 text-xs">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
