"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

export function CopyShareLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/exposure/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={copy} className="btn-ghost px-2 py-1 text-xs" title="Copy shareable link">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <a href={`/exposure/${token}`} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1 text-xs" title="Open report">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
