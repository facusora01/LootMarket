#!/usr/bin/env bash
# Seed masivo de listings con imagenes reales. Requiere DB levantada (docker compose up -d).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Seeding LootMarket (listings + imagenes)..."
node "$ROOT/server/seed.mjs"
echo "Listo."
