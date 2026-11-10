# PRET Collector — mini-appliance

A plug-and-play printer-audit sensor you pre-configure once and ship to a
customer. They plug in power + ethernet; it scans their fleet and reports to
your PRET cloud. Nothing to install on their PCs, no admin on their side.

## What you need

- A small always-on Linux box: a Raspberry Pi 4/5, an Intel NUC / mini-PC, or a
  small VM at the customer site. ~$60–150 of hardware, or a VM they already run.
- A fresh OS: Raspberry Pi OS Lite, Ubuntu Server, or Debian.

## Build an appliance (once, by you)

1. Flash the OS and boot the box on a network with internet access.
2. Register a collector in the PRET dashboard (**Collectors → Register**) and
   copy the token.
3. Provision it:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/appliance/provision.sh \
     | sudo bash -s -- <COLLECTOR_TOKEN> https://sentinelprint.onrender.com
   ```

   This installs Docker (if needed) and a `pret-collector` systemd service that
   auto-starts on boot, pulls the latest collector image, and restarts on
   failure.
4. Confirm it shows **Online** in the dashboard, then power off, label the box
   (customer name), and ship it.

## At the customer site

Plug in power and ethernet. Within a minute it's **Online** and ready — you run
audits against their subnet from your dashboard. Only outbound HTTPS is used; no
inbound ports, no firewall changes.

## Manage

```bash
systemctl status pret-collector      # health
journalctl -u pret-collector -f      # live logs
systemctl restart pret-collector     # restart (also pulls latest image)
```

To decommission: `sudo systemctl disable --now pret-collector` and revoke the
token in the dashboard.

## One box, many sites?

Use one appliance (and one collector token) per customer network. Tokens are
revocable per collector, so retiring or replacing a site's sensor never affects
others.
