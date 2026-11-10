"use client";

import { useActionState, useState } from "react";
import { Search, Share2, Check, ExternalLink } from "lucide-react";
import { operatorCheckAction, type CheckState } from "@/lib/actions/check";
import { ExposureResult } from "@/components/ExposureResult";

const initial: CheckState = {};

export function DomainCheckForm() {
  const [state, formAction, pending] = useActionState(operatorCheckAction, initial);
  const [copied, setCopied] = useState(false);

  const shareUrl = state.shareToken && typeof window !== "undefined" ? `${window.location.origin}/exposure/${state.shareToken}` : "";

  const copy = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-6">
      <form action={formAction} className="card space-y-3">
        <label className="label" htmlFor="domain">Domain to check</label>
        <div className="flex gap-3">
          <input id="domain" name="domain" className="input" placeholder="prospect.com" required />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            <Search className="h-4 w-4" /> {pending ? "Checking…" : "Check"}
          </button>
        </div>
        {state.error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>}
        <p className="text-xs text-slate-500">
          Passive only — DNS, certificate transparency, and internet-exposure data. No connection to the target, no
          email required, nothing logged as a lead.
        </p>
      </form>

      {state.shareToken && shareUrl && (
        <div className="card border-brand-400/30 bg-brand-500/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-200">
            <Share2 className="h-4 w-4" /> Shareable report link
          </div>
          <p className="mt-1 text-xs text-slate-400">A clean standalone page you can send to this prospect.</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={shareUrl} className="input flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy} className="btn-ghost shrink-0 text-xs">
              {copied ? <><Check className="h-4 w-4 text-emerald-400" /> Copied</> : <>Copy</>}
            </button>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="btn-ghost shrink-0 text-xs">
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          </div>
        </div>
      )}

      {state.result && <ExposureResult result={state.result} showCta={false} />}
    </div>
  );
}
