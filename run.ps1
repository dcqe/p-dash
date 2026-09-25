param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$dataRoot = if ($env:PDASH_DATA) { $env:PDASH_DATA } else { Join-Path $projectRoot '.pdash' }
$configPath = Join-Path $dataRoot 'config.json'
$settings = $null
if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($config.version -ne 1) { throw 'Unsupported config.json version; expected 1.' }
    $settings = $config.settings
    if ($settings -and ($settings.port -notmatch '^\d+$' -or [int]$settings.port -lt 1 -or [int]$settings.port -gt 65535 -or $settings.openBrowser -isnot [bool] -or $settings.demoEnabled -isnot [bool])) {
        throw 'Invalid config.json settings: port must be 1-65535 and openBrowser/demoEnabled must be booleans.'
    }
}
$port = if ($env:PDASH_PORT) { [int]$env:PDASH_PORT } elseif ($settings) { [int]$settings.port } else { 4310 }
if ($port -lt 1 -or $port -gt 65535) { throw 'Port must be 1-65535.' }
$openBrowser = -not $NoBrowser -and (-not $settings -or $settings.openBrowser)
$javaHome = $env:JAVA_HOME
if (-not $javaHome) {
    $portable = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($portable) { $javaHome = $portable.FullName }
}
$java = if ($javaHome) { Join-Path $javaHome 'bin\java.exe' } else { (Get-Command java.exe -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath $java)) { throw 'Install JDK 21+ and set JAVA_HOME.' }
$env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java)
$jar = Join-Path $projectRoot 'target\quarkus-app\quarkus-run.jar'

function Stop-PortOwners([int]$listenPort) {
    $connections = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $listenPort -State Listen -ErrorAction SilentlyContinue)
    $owners = @($connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne $PID })
    if (-not $owners) { return }
    Write-Host "Taking ownership of port $listenPort (stopping existing listener process tree: $($owners -join ', '))."
    foreach ($owner in $owners) {
        $killer = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', "$owner", '/T', '/F') -Wait -PassThru -WindowStyle Hidden
        if ($killer.ExitCode -ne 0) { Write-Warning "Could not stop process $owner (taskkill exit $($killer.ExitCode))." }
    }
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (-not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $listenPort -State Listen -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 250
    }
    throw "Could not take ownership of port $listenPort; a listener is still present."
}
# Ask the existing app to flush its state and stop its managed processes first.
$tokenPath = Join-Path $dataRoot 'auth/token'
if (-not (Test-Path -LiteralPath $tokenPath)) { $tokenPath = Join-Path $dataRoot 'token' }
$previousOwners = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if ($previousOwners.Count -and (Test-Path -LiteralPath $tokenPath)) {
    try {
        $headers = @{ Authorization = 'Bearer ' + (Get-Content -LiteralPath $tokenPath -Raw).Trim() }
        Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/shutdown" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 5 | Out-Null
        foreach ($previousOwner in $previousOwners) {
            Wait-Process -Id $previousOwner -Timeout 15 -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Warning 'Orderly shutdown unavailable; falling back to port-owner termination.'
    }
}
Stop-PortOwners $port

$maven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($maven) { $mvn = $maven.Source } else {
    $portableMaven = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'apache-maven-*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portableMaven) { throw 'Install Maven 3.9+ and put mvn.cmd on PATH.' }
    $mvn = Join-Path $portableMaven.FullName 'bin\mvn.cmd'
}
Push-Location (Join-Path $projectRoot 'frontend')
try {
    Write-Host 'Installing locked frontend dependencies...'
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
# A clean package also removes stale/deleted Java classes and copied web assets.
& $mvn '-Dmaven.repo.local=.tools/m2' -B clean package
if ($LASTEXITCODE -ne 0) { throw 'Java build or tests failed.' }
$env:PDASH_OWNER_PID = "$PID"
$env:PDASH_OPEN_BROWSER = if ($openBrowser) { 'true' } else { 'false' }
Write-Host "p-dash: fresh build ready. Stop this run to stop the app and its managed commands."
& $java '-Djava.awt.headless=false' "-Dquarkus.http.port=$port" -jar $jar
exit $LASTEXITCODE
