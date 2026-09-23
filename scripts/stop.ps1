$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = if ($env:PDASH_DATA) { [System.IO.Path]::GetFullPath($env:PDASH_DATA) } else { Join-Path $projectRoot '.pdash' }
$pidFile = Join-Path $dataDir 'launcher-server.pid'

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host 'No p-dash launcher PID file was found.'
    exit 0
}

$serverPid = 0
try { $serverPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim() } catch { throw 'The p-dash PID file is invalid.' }
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if (-not $process) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host 'p-dash is already stopped.'
    exit 0
}

$details = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid"
if (-not $details -or $details.CommandLine -notmatch 'server[\\/]index\.js') {
    throw "PID $serverPid is not identified as the p-dash server; nothing was stopped."
}

Stop-Process -Id $serverPid -Force
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Stopped p-dash (PID $serverPid)."
