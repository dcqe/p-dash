param(
    [switch]$NoBrowser,
    [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

try {
    $port = 4310
    if ($env:PDASH_PORT) { $port = [int]$env:PDASH_PORT }
    if ($port -lt 1 -or $port -gt 65535) { throw 'PDASH_PORT must be between 1 and 65535.' }
    $url = "http://127.0.0.1:$port"
    $dataDir = Join-Path $projectRoot '.pdash'
    if ($env:PDASH_DATA) { $dataDir = [System.IO.Path]::GetFullPath($env:PDASH_DATA) }
    $tokenFile = Join-Path $dataDir 'token'

    function Test-PDashReady {
        if (-not (Test-Path -LiteralPath $tokenFile)) { return $false }
        try {
            $token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
            $status = Invoke-RestMethod -Uri "$url/api/status" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 2
            return $status.name -eq 'p-dash' -and $status.cwd -eq $projectRoot
        } catch { return $false }
    }

    if (Test-PDashReady) {
        if ($Rebuild) { throw 'p-dash is already running. Stop its server before launching with -Rebuild.' }
        Write-Host "p-dash is already running at $url"
    } else {
        $socket = New-Object System.Net.Sockets.TcpClient
        try {
            $attempt = $socket.ConnectAsync('127.0.0.1', $port)
            try { $null = $attempt.Wait(1000) } catch {}
            if ($socket.Connected) { throw "Port $port is occupied by another server or p-dash instance. Check PDASH_PORT and PDASH_DATA." }
        } finally { $socket.Dispose() }

        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
        if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 22 or newer, then run launch.cmd again.' }
        $nodeVersion = & $nodePath --version
        if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw 'p-dash requires Node.js 22 or newer.' }

        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\.package-lock.json'))) {
            $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
            $npmPath = if ($npmCommand) { $npmCommand.Source } else { Join-Path (Split-Path $nodePath) 'npm.cmd' }
            if (-not (Test-Path -LiteralPath $npmPath)) { $npmPath = Join-Path $env:ProgramFiles 'nodejs\npm.cmd' }
            if (-not (Test-Path -LiteralPath $npmPath)) { throw 'npm was not found. Install Node.js with npm, then try again.' }
            Write-Host 'Installing p-dash dependencies...'
            & $npmPath ci
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        }

        if ($Rebuild -or -not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html'))) {
            Write-Host 'Building the dashboard...'
            & $nodePath (Join-Path $projectRoot 'node_modules\vite\bin\vite.js') build
            if ($LASTEXITCODE -ne 0) { throw 'Dashboard build failed.' }
        }

        $null = New-Item -ItemType Directory -Path $dataDir -Force
        $logFile = Join-Path $dataDir 'launcher-server.log'
        $errorFile = Join-Path $dataDir 'launcher-server-error.log'
        $serverFile = Join-Path $projectRoot 'server\index.js'
        $server = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverFile + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errorFile -PassThru
        $server.Id | Set-Content -LiteralPath (Join-Path $dataDir 'launcher-server.pid')
        $deadline = [DateTime]::UtcNow.AddSeconds(20)
        $ready = $false
        do {
            if (Test-PDashReady) { $ready = $true; break }
            $server.Refresh()
            if ($server.HasExited) { break }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $deadline)
        if (-not $ready) { throw "p-dash did not become ready. See $errorFile and $logFile" }
        Write-Host "Started p-dash at $url (PID $($server.Id))"
    }

    if (-not $NoBrowser) { Start-Process $url }
    Write-Host 'The server keeps running after this launcher closes.'
    exit 0
} catch {
    Write-Host "Unable to launch p-dash: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
