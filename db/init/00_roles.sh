#!/bin/bash
# ISO 27001 A.5.17 / A.8.9: el rol de la API (minimo privilegio, TP6) se crea con
# una password tomada del entorno ($APP_DB_PASSWORD), nunca hardcodeada en el SQL.
# Corre antes que los .sql (orden alfabetico) en el primer init del contenedor.
set -e

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD no definida (configurala en el .env raiz)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE lootmarket_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
EOSQL
