# PRET Collector — OFFLINE installer (runs from a USB drive at a customer site).
# Installs entirely from the local node.exe + collector.cjs on the drive;
# nothing is downloaded. Registers an always-on boot service (admin required).
#
# Normally launched by install.bat on the same drive. The token is read from
# -Token, then token.txt next to this script, then an interactive prompt.

param(
  [string]$SourceDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [string]$Token = $env:COLLECTOR_TOKEN,
  [string]$Url = $(if ($env:SENTINEL_URL) { $env:SENTINEL_URL } else { "https://sentinelprint.onrender.com" })
)

$ErrorActionPreference = "Stop"
$TaskName = "PRET Collector"
$InstallDir = Join-Path $env:ProgramData "PRETCollector"

# Admin check (install.bat self-elevates, but guard anyway).
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Run as administrator (use install.bat)."; exit 1
}

# Resolve token: param -> token.txt -> prompt.
if (-not $Token) {
  $tf = Join-Path $SourceDir "token.txt"
  if (Test-Path $tf) { $Token = (Get-Content $tf -Raw).Trim() }
}
if (-not $Token) { $Token = (Read-Host "Paste the collector token").Trim() }
if (-not $Token) { Write-Error "A collector token is required."; exit 1 }

$NodeSrc = Join-Path $SourceDir "node.exe"
$BundleSrc = Join-Path $SourceDir "collector.cjs"
if (-not (Test-Path $NodeSrc) -or -not (Test-Path $BundleSrc)) {
  Write-Error "node.exe / collector.cjs not found next to this script. Rebuild the USB with build-usb.ps1."; exit 1
}

Write-Host "Installing PRET Collector (offline) to $InstallDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $NodeSrc (Join-Path $InstallDir "node.exe") -Force
Copy-Item $BundleSrc (Join-Path $InstallDir "collector.cjs") -Force

@"
@echo off
set SENTINEL_URL=$Url
set COLLECTOR_TOKEN=$Token
"$InstallDir\node.exe" "$InstallDir\collector.cjs"
"@ | Set-Content (Join-Path $InstallDir "run.cmd") -Encoding ASCII

$Launcher = Join-Path $InstallDir "run.cmd"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute $Launcher
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "Done. The collector is running and will auto-start on boot." -ForegroundColor Green
Write-Host "It will appear as 'Online' in the PRET dashboard within a minute."
