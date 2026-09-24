param([switch]$NoBrowser, [switch]$Rebuild, [switch]$Dev)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$port = if ($env:PDASH_PORT) { [int]$env:PDASH_PORT } else { 4310 }
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
Stop-PortOwners $port

if ($Dev) {
    $maven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($maven) { $mvn = $maven.Source } else {
        $portableMaven = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'apache-maven-*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $portableMaven) { throw 'Install Maven 3.9+ and put mvn.cmd on PATH.' }
        $mvn = Join-Path $portableMaven.FullName 'bin\mvn.cmd'
    }
    $env:PDASH_OWNER_PID = "$PID"
    $env:PDASH_OPEN_BROWSER = if ($NoBrowser) { 'false' } else { 'true' }
    Write-Host "p-dash dev mode runs in this window. Java changes reload through Quarkus."
    & $mvn '-Dmaven.repo.local=.tools/m2' "-Dquarkus.http.port=$port" 'quarkus:dev'
    exit $LASTEXITCODE
}

$appJar = Join-Path $projectRoot 'target\quarkus-app\app\p-dash-2.0.0.jar'
$runtimeDat = Join-Path $projectRoot 'target\quarkus-app\quarkus\quarkus-application.dat'
$stale = -not (Test-Path -LiteralPath $appJar) -or -not (Test-Path -LiteralPath $runtimeDat)
$frontendBundle = Join-Path $projectRoot 'frontend\dist\index.html'
$frontendStale = -not (Test-Path -LiteralPath $frontendBundle)
if (-not $stale) {
    $inputs = @(Get-ChildItem -LiteralPath 'src\main','frontend\src','src\test' -Recurse -File) + @(Get-Item 'pom.xml','frontend\package.json','frontend\package-lock.json','frontend\vite.config.js','frontend\index.html')
    $builtAt = (Get-Item -LiteralPath $appJar).LastWriteTimeUtc
    $stale = @($inputs | Where-Object { $_.LastWriteTimeUtc -gt $builtAt }).Count -gt 0
    if (-not $frontendStale) {
        $frontendInputs = @(Get-ChildItem -LiteralPath 'frontend\src' -Recurse -File) + @(Get-Item 'frontend\package.json','frontend\package-lock.json','frontend\vite.config.js','frontend\index.html')
        $frontendStale = @($frontendInputs | Where-Object { $_.LastWriteTimeUtc -gt (Get-Item $frontendBundle).LastWriteTimeUtc }).Count -gt 0
    }
}
if ($Rebuild -or $stale -or -not (Test-Path -LiteralPath $jar)) {
    if ($Rebuild -or $frontendStale) {
        Push-Location (Join-Path $projectRoot 'frontend')
        try {
            # Keep startup fast when dependencies are already installed. npm ci
            # deletes and recreates node_modules, so it is only needed for a
            # fresh checkout or when the lockfile has changed.
            $viteBin = Get-Item -LiteralPath 'node_modules\.bin\vite.cmd' -ErrorAction SilentlyContinue
            $lockfile = Get-Item -LiteralPath 'package-lock.json' -ErrorAction SilentlyContinue
            if (-not $viteBin -or ($lockfile -and $lockfile.LastWriteTimeUtc -gt $viteBin.LastWriteTimeUtc)) {
                Write-Host 'Installing frontend dependencies...'
                & npm.cmd ci --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
            }
            Write-Host 'Building frontend...'
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
        } finally { Pop-Location }
    }
    $maven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($maven) { $mvn = $maven.Source } else {
        $portableMaven = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'apache-maven-*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $portableMaven) { throw 'Install Maven 3.9+ and put mvn.cmd on PATH.' }
        $mvn = Join-Path $portableMaven.FullName 'bin\mvn.cmd'
    }
    & $mvn '-Dmaven.repo.local=.tools/m2' -B package
    if ($LASTEXITCODE -ne 0) { throw 'Java build or tests failed.' }
}
$env:PDASH_OWNER_PID = "$PID"
$env:PDASH_OPEN_BROWSER = if ($NoBrowser) { 'false' } else { 'true' }
Write-Host "p-dash runs in this window. Ctrl+C or closing this window stops it and its managed commands."
# Direct invocation inherits this console. The Java owner watcher also handles an abruptly closed runner.
& $java '-Djava.awt.headless=false' -jar $jar
exit $LASTEXITCODE
