# LootMarket - frena API, cliente y DB
$root = $PSScriptRoot

if (Test-Path "$root\.pids") {
    foreach ($procId in Get-Content "$root\.pids") {
        if ($procId -match '^\d+$') {
            # /T mata el arbol completo (cmd -> npm -> node/vite)
            taskkill /PID $procId /T /F *> $null
        }
    }
    Remove-Item "$root\.pids" -Force
    Write-Host "API y cliente detenidos." -ForegroundColor Green
} else {
    Write-Host "No hay .pids - API/cliente no estaban corriendo (o se iniciaron a mano)." -ForegroundColor Yellow
}

Set-Location $root
docker compose down
Write-Host "DB detenida. Listo." -ForegroundColor Green
