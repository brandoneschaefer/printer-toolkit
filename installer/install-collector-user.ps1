# PRET Collector — no-admin Windows installer.
#
# Installs for the CURRENT USER only, with no administrator rights:
#  - files in %LOCALAPPDATA%\PRETCollector
#  - auto-starts at logon via a hidden Startup-folder launcher
#
# Trade-off vs the admin installer: this runs only while this user is logged
# in (it starts at their logon and stops at logoff), rather than as a boot
# service. Ideal for an always-signed-in back-office / reception PC.
#
#   $env:COLLECTOR_TOKEN="<token>"; irm <this-url> | iex

param(
  [string]$Token = $env:COLLECTOR_TOKEN,
  [string]$Url = $(if ($env:SENTINEL_URL) { $env:SENTINEL_URL } else { "https://sentinelprint.onrender.com" }),
  [string]$NodeVersion = "22.11.0",
  [string]$BundleUrl = "https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/dist/collector.cjs"
)

$ErrorActionPreference = "Stop"
if (-not $Token) { Write-Error "COLLECTOR_TOKEN is required. Set `$env:COLLECTOR_TOKEN first."; exit 1 }

$InstallDir = Join-Path $env:LOCALAPPDATA "PRETCollector"
Write-Host "Installing PRET Collector (no admin) to $InstallDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Portable Node runtime.
$NodeExe = Join-Path $InstallDir "node.exe"
if (-not (Test-Path $NodeExe)) {
  Write-Host "Downloading Node.js runtime ($NodeVersion)..."
  $zip = Join-Path $env:TEMP "pret-node.zip"; $ex = Join-Path $env:TEMP "pret-node"
  Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $zip -UseBasicParsing
  Remove-Item -Recurse -Force $ex -ErrorAction SilentlyContinue
  Expand-Archive $zip $ex -Force
  Copy-Item (Join-Path $ex "node-v$NodeVersion-win-x64\node.exe") $NodeExe -Force
  Remove-Item -Recurse -Force $ex, $zip -ErrorAction SilentlyContinue
}

# 2. Collector bundle.
Write-Host "Downloading collector..."
Invoke-WebRequest $BundleUrl -OutFile (Join-Path $InstallDir "collector.cjs") -UseBasicParsing

# 3. Launcher (sets config, runs the collector).
@"
@echo off
set SENTINEL_URL=$Url
set COLLECTOR_TOKEN=$Token
"$NodeExe" "$InstallDir\collector.cjs"
"@ | Set-Content (Join-Path $InstallDir "run.cmd") -Encoding ASCII

# 4. Hidden VBS launcher (no console window). Uses Chr(34) to avoid quote hell.
@"
Dim q
q = Chr(34)
CreateObject("WScript.Shell").Run "cmd /c " & q & "$InstallDir\run.cmd" & q, 0, False
"@ | Set-Content (Join-Path $InstallDir "start-hidden.vbs") -Encoding ASCII

# 5. Auto-start at logon: shortcut in the user's Startup folder (no admin).
$startup = [Environment]::GetFolderPath("Startup")
$lnk = Join-Path $startup "PRET Collector.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = "wscript.exe"
$sc.Arguments = "`"$InstallDir\start-hidden.vbs`""
$sc.WorkingDirectory = $InstallDir
$sc.Save()

# 6. Start now.
Start-Process wscript.exe -ArgumentList "`"$InstallDir\start-hidden.vbs`""

Write-Host ""
Write-Host "Done (no admin). The collector is running and will auto-start when $env:USERNAME logs in." -ForegroundColor Green
Write-Host "It will appear as 'Online' in your PRET dashboard within a minute."
Write-Host "To remove: delete '$lnk' and the folder '$InstallDir', then revoke the token in the dashboard."
