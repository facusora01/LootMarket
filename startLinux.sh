#!/usr/bin/env bash
# LootMarket - arranque completo en Linux/Mac (DB + API + cliente).
# Espejo de start.ps1. Genera los .env con secretos al azar y consistentes
# (ISO 27001 A.5.17/A.8.24: nada de secretos en el codigo), levanta todo y
# con Ctrl+C frena API, cliente y DB.
#
# Uso:  ./startLinux.sh            arranca y muestra logs en vivo
#       ./startLinux.sh --no-logs  arranca en segundo plano
#       ./startLinux.sh --reset    dropea el volumen de la DB (down -v) y recrea
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RESET=0; NO_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --reset|-r)   RESET=1 ;;
    --no-logs|-n) NO_LOGS=1 ;;
    *) echo "Opcion desconocida: $arg" >&2 ;;
  esac
done

gen_hex() { # $1 = bytes -> 2*$1 chars hex
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

open_url() {
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true
  elif command -v open     >/dev/null 2>&1; then open "$1"     >/dev/null 2>&1 || true
  fi
}

stop_app() {
  if [ -f "$ROOT/.pids" ]; then
    while read -r pid; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done < "$ROOT/.pids"
    rm -f "$ROOT/.pids"
  fi
  if command -v lsof >/dev/null 2>&1; then
    for port in 3001 5173; do
      local p; p="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
      [ -n "$p" ] && kill $p 2>/dev/null || true
    done
  fi
}

echo "==> LootMarket"

# 0. Instancia previa? -> reiniciar
if [ -f "$ROOT/.pids" ] || { command -v lsof >/dev/null 2>&1 && lsof -ti tcp:3001 >/dev/null 2>&1; }; then
  echo "Ya habia una instancia corriendo. Reiniciando..."
  stop_app
  sleep 1
fi

# 1. Docker listo?
if ! docker info >/dev/null 2>&1; then
  echo "Docker no responde. Arranca Docker Desktop/daemon y reintenta." >&2
  exit 1
fi

# 1b. Secretos en .env (no versionados). .env raiz -> compose; server/.env -> API.
#     APP_DB_PASSWORD (raiz) == PGPASSWORD (server). Se (re)generan si faltan O si
#     el valor esta vacio (ej: alguien copio el .env.example sin completarlo).
get_env() { grep "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- || true; }

ROOT_REGEN=0
APP_PASS="$(get_env APP_DB_PASSWORD "$ROOT/.env")"
if [ -z "$APP_PASS" ]; then
  echo "==> Generando .env raiz (passwords de la DB al azar)..."
  APP_PASS="$(gen_hex 24)"
  { echo "POSTGRES_PASSWORD=$(gen_hex 24)"; echo "APP_DB_PASSWORD=$APP_PASS"; } > "$ROOT/.env"
  ROOT_REGEN=1
fi

if [ "$ROOT_REGEN" -eq 1 ] || [ -z "$(get_env PAYMENT_KEY "$ROOT/server/.env")" ] || [ -z "$(get_env PGPASSWORD "$ROOT/server/.env")" ]; then
  echo "==> Generando server/.env (PAYMENT_KEY + PGPASSWORD)..."
  PAY="$(get_env PAYMENT_KEY "$ROOT/server/.env")"; [ -z "$PAY" ] && PAY="$(gen_hex 32)"
  {
    echo "PAYMENT_KEY=$PAY"
    echo "PGPASSWORD=$APP_PASS"
    echo "CORS_ORIGIN=http://localhost:5173"
  } > "$ROOT/server/.env"
fi

# 2. PostgreSQL
if [ "$RESET" -eq 1 ]; then
  echo "==> --reset: dropeando volumen de la DB (down -v)..."
  docker compose down -v >/dev/null 2>&1 || true
fi
echo "==> Levantando PostgreSQL (docker compose)..."
docker compose up -d

echo "==> Esperando a que la DB este lista..."
for _ in $(seq 1 30); do
  if docker exec lootmarket-db pg_isready -U postgres -d lootmarket >/dev/null 2>&1; then break; fi
  sleep 2
done
echo "    DB lista."

# 3. Dependencias (solo si faltan)
[ -d "$ROOT/server/node_modules" ] || { echo "==> npm install (server)..."; ( cd "$ROOT/server" && npm install ); }
[ -d "$ROOT/client/node_modules" ] || { echo "==> npm install (client)..."; ( cd "$ROOT/client" && npm install ); }

# 4. API y cliente en segundo plano, logs a archivo, PIDs guardados.
mkdir -p "$ROOT/.logs"
echo "==> Iniciando API (puerto 3001)..."
( cd "$ROOT/server" && npm run dev > "$ROOT/.logs/server.log" 2>&1 ) &
API_PID=$!
echo "==> Iniciando cliente (puerto 5173)..."
( cd "$ROOT/client" && npm run dev > "$ROOT/.logs/client.log" 2>&1 ) &
WEB_PID=$!
printf '%s\n%s\n' "$API_PID" "$WEB_PID" > "$ROOT/.pids"

# 5. Abrir navegador cuando el cliente responda
if command -v curl >/dev/null 2>&1; then
  for _ in $(seq 1 15); do
    if curl -sf http://localhost:5173 >/dev/null 2>&1; then open_url http://localhost:5173; break; fi
    sleep 2
  done
fi

cat <<EOF

LootMarket corriendo:
  Cliente: http://localhost:5173
  API:     http://localhost:3001
  DB:      localhost:5432 (lootmarket)

Usuarios demo (pass: password123): ana_buyer, carla_sells, mod_mati, admin_root
EOF

if [ "$NO_LOGS" -eq 1 ]; then
  echo ""
  echo "Corriendo en segundo plano. Para frenar: ./startLinux.sh (reinicia) o kill \$(cat .pids)."
  exit 0
fi

# 6. Logs en vivo. Ctrl+C frena TODO (API, cliente y DB) y cierra limpio.
cleanup() {
  echo ""
  echo "==> Cerrando LootMarket..."
  stop_app
  docker compose down >/dev/null 2>&1 || true
  echo "Todo detenido (API, cliente y DB)."
  exit 0
}
trap cleanup INT TERM

echo ""
echo "==> Logs en vivo (Ctrl+C frena API, cliente y DB):"
echo ""
tail -n +1 -f "$ROOT/.logs/server.log" "$ROOT/.logs/client.log" &
wait $!
