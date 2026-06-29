#!/usr/bin/env bash
# Genera .env raiz (POSTGRES_PASSWORD, APP_DB_PASSWORD) y server/.env
# (PAYMENT_KEY, PGPASSWORD, CORS_ORIGIN) con secretos al azar. Idempotente:
# (re)genera solo si faltan o si el valor esta vacio (ej: copiar el .env.example
# sin completarlo). APP_DB_PASSWORD (raiz) == PGPASSWORD (server).
# ISO 27001 A.5.17/A.8.24: ningun secreto vive en el codigo ni se versiona.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV="$ROOT/.env"
SERVER_ENV="$ROOT/server/.env"

gen_hex() { # $1 = bytes -> 2*$1 chars hex
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}
get_env() { grep "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- || true; }

root_regen=0
app_pass="$(get_env APP_DB_PASSWORD "$ROOT_ENV")"
if [ -z "$app_pass" ]; then
  app_pass="$(gen_hex 24)"
  { echo "POSTGRES_PASSWORD=$(gen_hex 24)"; echo "APP_DB_PASSWORD=$app_pass"; } > "$ROOT_ENV"
  echo "Generado .env raiz (secretos de la DB)."
  root_regen=1
fi

if [ "$root_regen" -eq 1 ] || [ -z "$(get_env PAYMENT_KEY "$SERVER_ENV")" ] || [ -z "$(get_env PGPASSWORD "$SERVER_ENV")" ]; then
  pay="$(get_env PAYMENT_KEY "$SERVER_ENV")"; [ -z "$pay" ] && pay="$(gen_hex 32)"
  {
    echo "PAYMENT_KEY=$pay"
    echo "PGPASSWORD=$app_pass"
    echo "CORS_ORIGIN=http://localhost:5173"
  } > "$SERVER_ENV"
  echo "Generado server/.env (PAYMENT_KEY + PGPASSWORD)."
fi

echo "Secretos listos."
