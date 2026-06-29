# LootMarket - arranque completo (DB + API + cliente), sin ventanas extra.
# API y cliente corren ocultos; esta consola muestra sus logs en tiempo real.
# Ctrl+C frena TODO (API, cliente y DB) y cierra limpio. No hace falta stop.ps1.
# Si ya hay una instancia corriendo, .\start.ps1 la reinicia.
# .\start.ps1 -NoLogs  -> arranca en segundo plano y termina sin mostrar logs
param([switch]$NoLogs)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Frena procesos (API + cliente por PID y por puerto) y, opcional, la DB.
function Stop-LootMarket {
    param([switch]$IncludeDb)

    if (Test-Path "$root\.pids") {
        foreach ($procId in Get-Content "$root\.pids") {
            if ($procId -match '^\d+$') {
                # /T mata el arbol completo (cmd -> npm -> node/vite)
                # Redireccion dentro de cmd: evita que PS 5.1 trate el stderr
                # de un PID inexistente como error terminante (ErrorAction Stop).
                cmd /c "taskkill /PID $procId /T /F >nul 2>nul"
            }
        }
        Remove-Item "$root\.pids" -Force -ErrorAction SilentlyContinue
    }

    # Por las dudas: liberar puertos si quedaron procesos huerfanos.
    $conns = Get-NetTCPConnection -LocalPort 3001, 5173 -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        cmd /c "taskkill /PID $($c.OwningProcess) /T /F >nul 2>nul"
    }

    if ($IncludeDb) {
        Set-Location $root
        docker compose down *> $null
    }
}

Write-Host "==> LootMarket" -ForegroundColor Cyan

# 0. Ya hay algo corriendo? -> reiniciar (cerrar lo anterior y seguir).
$running = (Test-Path "$root\.pids") -or `
    (Get-NetTCPConnection -LocalPort 3001, 5173 -State Listen -ErrorAction SilentlyContinue)
if ($running) {
    Write-Host "Ya habia una instancia corriendo. Reiniciando..." -ForegroundColor Yellow
    Stop-LootMarket
    Start-Sleep -Seconds 1
}

# 1. Docker engine listo?
docker info *> $null
if (-not $?) {
    Write-Host "Docker no responde. Abriendo Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $deadline = (Get-Date).AddSeconds(120)
    do {
        Start-Sleep -Seconds 5
        docker info *> $null
    } until ($? -or (Get-Date) -gt $deadline)
    if (-not $?) { Write-Host "Docker no arranco en 120s. Abortando." -ForegroundColor Red; exit 1 }
}

# 2. PostgreSQL
Write-Host "==> Levantando PostgreSQL (docker compose)..." -ForegroundColor Cyan
Set-Location $root
docker compose up -d
if (-not $?) { Write-Host "Fallo docker compose." -ForegroundColor Red; exit 1 }

Write-Host "==> Esperando a que la DB este lista..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(60)
do {
    Start-Sleep -Seconds 2
    docker exec lootmarket-db pg_isready -U postgres -d lootmarket *> $null
} until ($? -or (Get-Date) -gt $deadline)
if (-not $?) { Write-Host "DB no respondio en 60s. Revisar: docker logs lootmarket-db" -ForegroundColor Red; exit 1 }
Write-Host "    DB lista." -ForegroundColor Green

# 3. Dependencias (solo si faltan)
if (-not (Test-Path "$root\server\node_modules")) {
    Write-Host "==> npm install (server)..." -ForegroundColor Cyan
    Push-Location "$root\server"; npm install; Pop-Location
}
if (-not (Test-Path "$root\client\node_modules")) {
    Write-Host "==> npm install (client)..." -ForegroundColor Cyan
    Push-Location "$root\client"; npm install; Pop-Location
}

# 4. API y cliente ocultos, logs a archivo, PIDs guardados.
New-Item -ItemType Directory -Force "$root\.logs" | Out-Null

Write-Host "==> Iniciando API (puerto 3001)..." -ForegroundColor Cyan
$api = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory "$root\server" -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput "$root\.logs\server.log" `
    -RedirectStandardError "$root\.logs\server.err.log"

Write-Host "==> Iniciando cliente (puerto 5173)..." -ForegroundColor Cyan
$web = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory "$root\client" -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput "$root\.logs\client.log" `
    -RedirectStandardError "$root\.logs\client.err.log"

"$($api.Id)`n$($web.Id)" | Set-Content "$root\.pids"

# 5. Abrir navegador cuando el cliente responda
$deadline = (Get-Date).AddSeconds(30)
do {
    Start-Sleep -Seconds 2
    try { Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 2 *> $null; $up = $true }
    catch { $up = $false }
} until ($up -or (Get-Date) -gt $deadline)

if ($up) { Start-Process "http://localhost:5173" }
else { Write-Host "El cliente no respondio en 30s - revisar .logs\client.log" -ForegroundColor Yellow }

Write-Host ""
Write-Host "LootMarket corriendo:" -ForegroundColor Green
Write-Host "  Cliente: http://localhost:5173"
Write-Host "  API:     http://localhost:3001"
Write-Host "  DB:      localhost:5432 (lootmarket)"
Write-Host ""
Write-Host "Usuarios demo (pass: password123): ana_buyer, carla_sells, mod_mati, admin_root"
Write-Host ""

if ($NoLogs) {
    Write-Host "Corriendo en segundo plano. Para frenar: .\start.ps1 (reinicia) o .\stop.ps1." -ForegroundColor Yellow
    exit 0
}

# 6. Logs en tiempo real. Ctrl+C frena TODO y cierra limpio.
Write-Host "==> Logs en vivo (Ctrl+C frena API, cliente y DB):" -ForegroundColor Cyan
Write-Host ""

$tails = @(
    @{ Tag = '[API]'; Color = 'Cyan';   File = "$root\.logs\server.log" },
    @{ Tag = '[API]'; Color = 'Red';    File = "$root\.logs\server.err.log" },
    @{ Tag = '[WEB]'; Color = 'Green';  File = "$root\.logs\client.log" },
    @{ Tag = '[WEB]'; Color = 'Red';    File = "$root\.logs\client.err.log" }
)
$jobs = @()
foreach ($t in $tails) {
    $jobs += ,@((Start-Job -ScriptBlock {
        param($f)
        Get-Content -Path $f -Wait
    } -ArgumentList $t.File), $t.Tag, $t.Color)
}

try {
    while ($true) {
        foreach ($j in $jobs) {
            Receive-Job $j[0] | ForEach-Object { Write-Host "$($j[1]) $_" -ForegroundColor $j[2] }
        }
        Start-Sleep -Milliseconds 300
    }
} finally {
    # Ctrl+C (o fin del loop): cortar tails y frenar TODO, incluida la DB.
    Write-Host ""
    Write-Host "==> Cerrando LootMarket..." -ForegroundColor Yellow
    $jobs | ForEach-Object { Stop-Job $_[0] -ErrorAction SilentlyContinue; Remove-Job $_[0] -Force -ErrorAction SilentlyContinue }
    Stop-LootMarket -IncludeDb
    Write-Host "Todo detenido (API, cliente y DB)." -ForegroundColor Green
}
