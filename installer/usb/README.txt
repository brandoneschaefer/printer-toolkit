PRET Collector — USB installer
==============================

This drive installs the PRET printer-security sensor on a Windows PC at a
customer site. Everything needed is on the drive — no internet download is
required during install (the sensor only needs internet afterward to reach
the PRET cloud).

AT THE CUSTOMER SITE
--------------------
1. Register a collector for this customer in the PRET dashboard
   (Collectors -> Register) and copy the token. (Do this once, in advance,
   or on-site from your phone/laptop.)
2. Plug this USB drive into an always-on Windows PC on their network.
3. (Optional) Open token.txt and paste the collector token, then save.
   If you skip this, the installer will ask you to paste it.
4. Double-click install.bat and click "Yes" on the Windows prompt.
5. The sensor installs and starts. It appears as "Online" in your dashboard
   within a minute.

That's it. It runs as a background service and auto-starts on every reboot.

FILES
-----
install.bat          Double-click to install (asks for admin once).
offline-install.ps1  The installer it runs (don't run directly).
node.exe             Bundled runtime (nothing to install).
collector.cjs        The sensor.
token.txt            Optional: paste the collector token here.

TO REMOVE
---------
Run uninstall from the dashboard instructions, or delete the scheduled task
"PRET Collector" and the folder C:\ProgramData\PRETCollector, then revoke the
token in the dashboard.
