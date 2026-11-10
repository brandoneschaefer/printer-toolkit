@echo off
REM PRET Collector - offline USB installer. Double-click to install.
REM Installs from the node.exe + collector.cjs on this drive (no download).

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Installing PRET Collector from this drive...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0offline-install.ps1" -SourceDir "%~dp0."
echo.
echo You can close this window.
pause
