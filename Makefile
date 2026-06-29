# LootMarket - tareas de desarrollo (Linux/Mac). Requiere: docker, node/npm.
# Uso: make <target>.  `make help` lista todo.
#
# Flujo tipico:
#   make install     # una vez
#   make up          # DB lista (crea schema/RLS/cuentas demo automaticamente)
#   make seed        # catalogo completo (~100 listings, opcional)
#   make api         # en una terminal  (Ctrl+C frena)
#   make web         # en otra terminal (Ctrl+C frena)
#   make test        # suite de integracion m9
#   make down        # frena la DB (mantiene datos)

SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help env up wait seed install api web test reset down logs

help: ## Lista los targets disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-9s\033[0m %s\n",$$1,$$2}'

env: ## Genera los .env con secretos al azar (si faltan o estan vacios)
	@bash scripts/gen-env.sh

up: env ## Levanta la DB (docker compose) y espera a que este lista
	@docker compose up -d
	@$(MAKE) -s wait

wait:
	@echo "Esperando DB..."; \
	for i in $$(seq 1 30); do \
		docker exec lootmarket-db pg_isready -U postgres -d lootmarket >/dev/null 2>&1 && break; \
		sleep 1; \
	done; \
	echo "DB lista."

seed: ## Carga el catalogo completo (~100 listings con imagenes)
	@node server/seed.mjs

install: ## Instala dependencias (server + client)
	@cd server && npm install
	@cd client && npm install

api: ## Corre la API en foreground (3001). Ctrl+C para frenar.
	@cd server && npm run dev

web: ## Corre el cliente en foreground (5173). Ctrl+C para frenar.
	@cd client && npm run dev

test: ## Corre la suite de integracion m9 (requiere API viva)
	@node server/tests/m9.mjs

reset: ## Recrea la DB desde cero (BORRA datos) + re-aplica init
	@docker compose down -v
	@$(MAKE) -s up

down: ## Frena los contenedores (mantiene el volumen/datos)
	@docker compose down

logs: ## Sigue los logs de la DB
	@docker compose logs -f db
