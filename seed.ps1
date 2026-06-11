# Seed masivo de listings con imagenes reales. Requiere DB levantada (docker compose up -d).
# Corre el script node que hace la migracion idempotente + carga ~100 items.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Seeding LootMarket (listings + imagenes)..." -ForegroundColor Cyan
node "$root\server\seed.mjs"
if ($LASTEXITCODE -ne 0) { Write-Host "Seed fallo." -ForegroundColor Red; exit 1 }
Write-Host "Listo." -ForegroundColor Green
