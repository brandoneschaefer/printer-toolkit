# SentinelPrint Collector — one-click Windows installer.
#
# Installs the collector as an always-on background task (runs at startup as
# SYSTEM, restarts on failure). No Docker required. Downloads a small Node.js
# runtime and the collector bundle into ProgramData.
#
# Run in an **Administrator** PowerShell. Two ways:
#
#   # A) one-liner (from the Collectors page), token via env var:
#   $env:COLLECTOR_TOKEN="<token>"; irm <this-url> | iex
#
#   # B) downloaded file:
#   .\install-collector.ps1 -Token "<token>" -Url "https://your-app.onrender.com"
#
# Uninstall with uninstall-collector.ps1.

param(
  [string]$Token = $env:COLLECTOR_TOKEN,
  [string]$Url = $(if ($env:SENTINEL_URL) { $env:SENTINEL_URL } else { "https://sentinelprint.onrender.com" }),
  [string]$NodeVersion = "22.11.0",
  [string]$BundleUrl = "https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/dist/collector.cjs"
)

$ErrorActionPreference = "Stop"
$TaskName = "SentinelPrint Collector"
$InstallDir = Join-Path $env:ProgramData "SentinelPrintCollector"

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run this in an Administrator PowerShell (right-click PowerShell -> Run as administrator)."
    exit 1
  }
}

Assert-Admin
if (-not $Token) { Write-Error "COLLECTOR_TOKEN is required. Set `$env:COLLECTOR_TOKEN or pass -Token."; exit 1 }

Write-Host "Installing SentinelPrint Collector to $InstallDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Portable Node.js runtime (only if not already present).
$NodeExe = Join-Path $InstallDir "node.exe"
if (-not (Test-Path $NodeExe)) {
  Write-Host "Downloading Node.js runtime ($NodeVersion)..."
  $zip = Join-Path $env:TEMP "sp-node.zip"
  $extract = Join-Path $env:TEMP "sp-node"
  $nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $zip -UseBasicParsing
  Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  Copy-Item (Join-Path $extract "node-v$NodeVersion-win-x64\node.exe") $NodeExe -Force
  Remove-Item -Recurse -Force $extract, $zip -ErrorAction SilentlyContinue
}

# 2. Collector bundle (always refresh to latest).
Write-Host "Downloading collector..."
Invoke-WebRequest -Uri $BundleUrl -OutFile (Join-Path $InstallDir "collector.cjs") -UseBasicParsing

# 3. Launcher that injects config and runs the collector.
$Launcher = Join-Path $InstallDir "run.cmd"
@"
@echo off
set SENTINEL_URL=$Url
set COLLECTOR_TOKEN=$Token
"$NodeExe" "$InstallDir\collector.cjs"
"@ | Set-Content -Path $Launcher -Encoding ASCII

# 4. Register as an always-on scheduled task (startup, SYSTEM, auto-restart).
Write-Host "Registering background task..."
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
Write-Host "It should appear as 'Online' in your SentinelPrint dashboard within a minute."
Write-Host "To remove it later, run uninstall-collector.ps1 as administrator."
