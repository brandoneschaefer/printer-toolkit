"use client";

import { useActionState, useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { createCollectorAction, type CollectorActionState } from "@/lib/actions/collectors";

const initial: CollectorActionState = {};

export function CollectorManager({
  appUrl,
  image,
  installerUrl,
}: {
  appUrl: string;
  image: string;
  installerUrl: string;
}) {
  const [state, formAction, pending] = useActionState(createCollectorAction, initial);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"windows" | "docker">("windows");

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  // Generate a self-elevating .bat with the token baked in. Double-click ->
  // one UAC prompt -> installs. No manual admin PowerShell needed.
  const downloadBat = (token: string) => {
    const bat = [
      "@echo off",
      "REM PRET Collector installer - double-click to install.",
      "net session >nul 2>&1",
      "if %errorlevel% neq 0 (",
      '  echo Requesting administrator permission...',
      "  powershell -Command \"Start-Process -FilePath '%~f0' -Verb RunAs\"",
      "  exit /b",
      ")",
      "echo Installing PRET Collector...",
      `powershell -ExecutionPolicy Bypass -NoProfile -Command "$env:COLLECTOR_TOKEN='${token}'; $env:SENTINEL_URL='${appUrl}'; irm ${installerUrl} | iex"`,
      "echo.",
      "echo Done. You can close this window.",
      "pause",
      "",
    ].join("\r\n");
    const blob = new Blob([bat], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "install-sentinel-collector.bat";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4">
        <h2 className="font-semibold text-white">Register a collector</h2>
        <p className="text-sm text-slate-400">
          Install a collector inside the network you want to audit. It pulls jobs from PRET and runs the
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

          {/* Install method tabs */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab("windows")} className={`btn text-xs ${tab === "windows" ? "bg-brand-500 text-white" : "border border-white/10 bg-white/5 text-slate-300"}`}>
              Windows (one-click)
            </button>
            <button type="button" onClick={() => setTab("docker")} className={`btn text-xs ${tab === "docker" ? "bg-brand-500 text-white" : "border border-white/10 bg-white/5 text-slate-300"}`}>
              Docker (Linux / server)
            </button>
          </div>

          {tab === "windows" ? (
            <div className="rounded-lg border border-white/10 bg-ink-900 p-3 text-xs text-slate-400">
              <div className="mb-1 font-semibold text-slate-200">Easiest: download &amp; double-click</div>
              <p className="mb-3 text-slate-400">
                On an always-on Windows PC in the target network, download this installer, double-click it, and
                click <span className="text-white">Yes</span> on the Windows permission prompt. That&apos;s it — no
                command line.
              </p>
              <button type="button" onClick={() => downloadBat(state.token!)} className="btn-primary text-xs">
                <Download className="h-4 w-4" /> Download installer (.bat)
              </button>

              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-2 font-semibold text-slate-300">Or, advanced: run in an Administrator PowerShell</div>
                <CopyBlock
                  text={`$env:COLLECTOR_TOKEN="${state.token}"; $env:SENTINEL_URL="${appUrl}"; irm ${installerUrl} | iex`}
                  copied={copied === "win"}
                  onCopy={() => copy(`$env:COLLECTOR_TOKEN="${state.token}"; $env:SENTINEL_URL="${appUrl}"; irm ${installerUrl} | iex`, "win")}
                />
              </div>
              <div className="mt-2 text-slate-500">
                Installs a lightweight background service (no Docker). Auto-starts on boot, outbound HTTPS only.
                Appears as “Online” here within a minute.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-ink-900 p-3 text-xs text-slate-400">
              <div className="mb-2 font-semibold text-slate-300">On any Linux host / server in the target network:</div>
              <CopyBlock
                text={`docker run -d --name sentinel-collector --restart unless-stopped --network host \\
  -e SENTINEL_URL=${appUrl} \\
  -e COLLECTOR_TOKEN=${state.token} \\
  ${image}`}
                copied={copied === "dock"}
                onCopy={() => copy(`docker run -d --name sentinel-collector --restart unless-stopped --network host -e SENTINEL_URL=${appUrl} -e COLLECTOR_TOKEN=${state.token} ${image}`, "dock")}
              />
              <div className="mt-2 text-slate-500">Outbound HTTPS only — no inbound ports.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyBlock({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2">{text}</pre>
      <button type="button" onClick={onCopy} className="btn-ghost shrink-0 text-xs">
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
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
