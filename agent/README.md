# SentinelPrint Collector Agent

The collector is a small, read-only agent you run **inside the network you want
to audit**. It lets SentinelPrint assess printers on private VLANs
(`10.x` / `192.168.x`) that a cloud server could never reach — without exposing
any printer to the internet.

## How it works

```
  Customer network (private)                 SentinelPrint (cloud)
  ┌───────────────────────────┐              ┌────────────────────────┐
  │  printers (9100/161/80…)   │              │  control plane + DB    │
  │        ▲                   │   HTTPS out  │  (audits, billing, UI) │
  │        │ scans locally     │◀────────────▶│                        │
  │  ┌─────┴───────┐  poll/post│   (agent     │   POST /api/collector/ │
  │  │  collector  │───────────┼──────────────▶      claim | results   │
  │  └─────────────┘           │  only the    │                        │
  └───────────────────────────┘  agent dials out)
```

1. The agent authenticates with its token and polls `POST /api/collector/claim`.
2. When an audit is created with **On-prem collector** execution, the control
   plane queues it for that collector. The agent claims the job and receives the
   expanded host list.
3. The agent runs the **same read-only scan engine** as the cloud runner and
   posts findings to `POST /api/collector/results`.
4. The control plane recomputes the risk score server-side and marks the audit
   complete. Results appear in the dashboard exactly like a cloud scan.

Only outbound HTTPS from the agent is required — no inbound ports, no VPN.

## Register a collector

In the app: **Dashboard → Collectors → Register a collector**. Copy the token
(shown once).

## Install options

| Method | Best for | Admin? | How |
|--------|----------|--------|-----|
| **Windows one-click (.bat)** | Small offices with an always-on Windows PC | One UAC click | Download + double-click — installs a boot service, no Docker |
| **Windows no-admin** | PCs where no one has admin rights | None | `install-collector-user.ps1` — runs at the user's logon |
| **Mini-appliance (Linux)** | Ship a plug-and-play sensor to a site | Root on the box (by you) | `appliance/provision.sh` — systemd service, boots and scans |
| **Docker** | Linux hosts, servers, NAS | Docker access | `docker run` (below) |
| **Node** | Development / custom | — | `npm run agent` (below) |

See [`../appliance/README.md`](../appliance/README.md) for the mini-appliance build.

### Windows one-click (no Docker)

On an always-on Windows PC inside the target network, open **PowerShell as
Administrator** and paste the command shown on the **Collectors** page:

```powershell
$env:COLLECTOR_TOKEN="<token>"; $env:SENTINEL_URL="https://your-app.onrender.com"; irm https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/installer/install-collector.ps1 | iex
```

This downloads a small Node runtime + the collector bundle into
`%ProgramData%\SentinelPrintCollector`, and registers an always-on background
task (starts at boot, restarts on failure, runs as SYSTEM). Remove it with
`installer/uninstall-collector.ps1`.

## Run it

**Docker (recommended):**

```bash
# build once from the repo root
docker build -f agent/Dockerfile -t sentinelprint-collector .

# run inside the target network
docker run -d --name sentinel-collector --network host \
  -e SENTINEL_URL=https://your-app.onrender.com \
  -e COLLECTOR_TOKEN=<id.secret> \
  sentinelprint-collector
```

`--network host` lets the agent reach printers directly on the LAN.

**Node (no Docker):**

```bash
SENTINEL_URL=https://your-app.onrender.com \
COLLECTOR_TOKEN=<id.secret> \
npm run agent
```

## Environment

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `SENTINEL_URL` | yes | `http://localhost:3000` | Control-plane base URL |
| `COLLECTOR_TOKEN` | yes | — | Token from the Collectors page (`id.secret`) |
| `POLL_INTERVAL_MS` | no | `5000` | How often to poll for jobs |

## Security notes

- The agent only ever makes **outbound** calls; expose nothing inbound.
- It performs **non-destructive** probes only — identical to the cloud engine.
- The token authorizes claiming/returning jobs for one organization. Revoke it
  any time from the Collectors page; revocation is immediate.
- Run the agent as an unprivileged user. `--network host` is only needed so it
  can route to printers; it needs no elevated capabilities for the scan itself.
