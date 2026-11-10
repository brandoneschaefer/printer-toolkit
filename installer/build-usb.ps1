# PRET Collector — build a self-contained USB installer.
#
# Run this ONCE on your own PC. It assembles a folder containing the Node
# runtime, the collector, and the offline installer. Copy that folder to a
# thumb drive and take it on-site — installs with no internet download.
#
#   irm https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/installer/build-usb.ps1 | iex
#   # or:  .\build-usb.ps1 -OutDir D:\PRET-Collector-USB -Token <token>

param(
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath("Desktop")) "PRET-Collector-USB"),
  [string]$Token = "",
  [string]$NodeVersion = "22.11.0",
  [string]$Repo = "https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "Building USB installer in $OutDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# 1. Node runtime.
Write-Host "Downloading Node.js $NodeVersion ..."
$zip = Join-Path $env:TEMP "pret-node.zip"; $ex = Join-Path $env:TEMP "pret-node"
Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $zip -UseBasicParsing
Remove-Item -Recurse -Force $ex -ErrorAction SilentlyContinue
Expand-Archive $zip $ex -Force
Copy-Item (Join-Path $ex "node-v$NodeVersion-win-x64\node.exe") (Join-Path $OutDir "node.exe") -Force
Remove-Item -Recurse -Force $ex, $zip -ErrorAction SilentlyContinue

# 2. Collector + offline installer files.
Write-Host "Downloading collector + installer files ..."
$files = @{
  "collector.cjs"       = "$Repo/dist/collector.cjs"
  "install.bat"         = "$Repo/installer/usb/install.bat"
  "offline-install.ps1" = "$Repo/installer/usb/offline-install.ps1"
  "README.txt"          = "$Repo/installer/usb/README.txt"
}
foreach ($name in $files.Keys) {
  Invoke-WebRequest $files[$name] -OutFile (Join-Path $OutDir $name) -UseBasicParsing
}

# 3. Optional pre-filled token.
if ($Token) { Set-Content (Join-Path $OutDir "token.txt") $Token -Encoding ASCII; Write-Host "Token pre-filled in token.txt" }
else { Set-Content (Join-Path $OutDir "token.txt") "" -Encoding ASCII }

Write-Host ""
Write-Host "Done. Copy this folder to a USB drive:" -ForegroundColor Green
Write-Host "  $OutDir"
Write-Host "On-site: paste the collector token into token.txt (or let install.bat ask), then run install.bat."
