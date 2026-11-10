# SentinelPrint Collector — uninstaller. Run in an Administrator PowerShell.
#   irm <this-url> | iex
# or:  .\uninstall-collector.ps1

$ErrorActionPreference = "SilentlyContinue"
$TaskName = "SentinelPrint Collector"
$InstallDir = Join-Path $env:ProgramData "SentinelPrintCollector"

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$p = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Please run this in an Administrator PowerShell."
  exit 1
}

Write-Host "Stopping and removing the SentinelPrint Collector..."
Stop-ScheduledTask -TaskName $TaskName
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
# Kill any running node from the install dir.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*SentinelPrintCollector*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item -Recurse -Force $InstallDir
Write-Host "Removed. (Also revoke the collector's token from the dashboard.)" -ForegroundColor Green
