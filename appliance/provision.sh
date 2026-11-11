#!/usr/bin/env bash
# Printer Toolkit Collector — mini-appliance provisioning.
#
# Turns a fresh Linux box (Raspberry Pi, mini-PC, VM) into a plug-and-play
# printer-audit sensor: installs Docker if needed, runs the collector as a
# systemd service that auto-starts on boot and restarts on failure.
#
# Run ONCE on the appliance:
#   curl -fsSL <this-url> | sudo bash -s -- <COLLECTOR_TOKEN> [SENTINEL_URL]
# or:
#   sudo bash provision.sh <COLLECTOR_TOKEN> [SENTINEL_URL]
#
# After provisioning, label the box and ship it to the customer site. They
# plug in power + ethernet and it starts auditing — nothing else to install.

set -euo pipefail

TOKEN="${1:-}"
URL="${2:-https://printertoolkit.com}"
IMAGE="${PRET_COLLECTOR_IMAGE:-ghcr.io/brandoneschaefer/printertoolkit-collector:latest}"

if [ -z "$TOKEN" ]; then
  echo "Usage: sudo bash provision.sh <COLLECTOR_TOKEN> [SENTINEL_URL]" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

echo "==> Installing Docker (if needed)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker || true

echo "==> Writing configuration..."
install -m 600 /dev/stdin /etc/pret-collector.env <<EOF
SENTINEL_URL=$URL
COLLECTOR_TOKEN=$TOKEN
PRET_COLLECTOR_IMAGE=$IMAGE
EOF

echo "==> Installing systemd service..."
cat > /etc/systemd/system/pret-collector.service <<'EOF'
[Unit]
Description=Printer Toolkit Collector (printer security sensor)
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
EnvironmentFile=/etc/pret-collector.env
# Refresh to the latest collector image on each (re)start.
ExecStartPre=-/usr/bin/docker pull ${PRET_COLLECTOR_IMAGE}
ExecStartPre=-/usr/bin/docker rm -f pret-collector
ExecStart=/usr/bin/docker run --rm --name pret-collector --network host --env-file /etc/pret-collector.env ${PRET_COLLECTOR_IMAGE}
ExecStop=/usr/bin/docker stop pret-collector
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "==> Enabling and starting..."
systemctl daemon-reload
systemctl enable --now pret-collector.service

echo ""
echo "Printer Toolkit collector installed. It will auto-start on boot and reconnect automatically."
echo "Status:  systemctl status pret-collector"
echo "Logs:    journalctl -u pret-collector -f"
