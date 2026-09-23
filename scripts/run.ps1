param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$port = if ($env:PDASH_PORT) { [int]$env:PDASH_PORT } else { 4310 }
$url = "http://127.0.0.1:$port"
$node = (Get-Command node.exe -ErrorAction Stop).Source
$server = $null

try {
    $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($existing) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($existing[0].OwningProcess)" -ErrorAction SilentlyContinue
        if ($owner -and $owner.CommandLine -match 'server[\\/]index\.js') {
            Stop-Process -Id $existing[0].OwningProcess -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 300
        } else {
            throw "Port $port is already in use by another application."
        }
    }
    $server = Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $projectRoot 'server\index.js') + '"') -WorkingDirectory $projectRoot -PassThru
    $dataRoot = if ($env:PDASH_DATA) { $env:PDASH_DATA } else { Join-Path $projectRoot '.pdash' }
    $tokenFile = Join-Path $dataRoot 'token'
    $ready = $false
    for ($i = 0; $i -lt 80; $i++) {
        if (Test-Path $tokenFile) {
            try { $status = Invoke-RestMethod "$url/api/status" -Headers @{ Authorization = "Bearer $((Get-Content $tokenFile -Raw).Trim())" } -TimeoutSec 1; if ($status.name -eq 'p-dash') { $ready = $true; break } } catch {}
        }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'p-dash did not become ready.' }
    if (-not $NoBrowser) { Start-Process $url }
    Write-Host "p-dash is running at $url. Keep this window open; closing it stops p-dash."
    Wait-Process -Id $server.Id
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
