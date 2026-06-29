# 🎮 LootMarket — Marketplace de Gaming

## Integrantes

| Integrante | Legajo |
|---|---|
| Facundo Sorasio | 108882 |
| Mateo Sparta | 109418 |
| Tomas Ruiz | [Agregar Aquí] |
| Jose Zerpa | 110698 |
| Rodrigo Vargas | 97076 |

Marketplace peer-to-peer de cuentas, skins, ítems y claves de activación, con
escrow, historial de trades auditable y resolución de disputas.

**Stack:** React (Vite) · Node/Express · PostgreSQL 16 (Docker)

## Funcionalidades

- **Cuenta única**: toda cuenta normal (`user`) puede **comprar y vender** — es un marketplace P2P, no hay roles separados de comprador/vendedor.
- **Catálogo**: búsqueda, filtros (categoría, precio), orden y paginación; "Explorar mercado" lista todos los productos.
- **Escrow completo**: compra → vendedor transfiere → comprador confirma → fondos liberados. Con disputas y resolución por moderador.
- **Perfil** (`/profile`): datos de la cuenta, mis publicaciones (editar precio / borrar), resumen de trades y medios de pago.
- **Notificaciones** in-app de compra/venta/escrow/disputa (campana en el header).
- **Seguridad** (TP1-8): RLS/ABAC, DDM, cifrado en reposo, auditoría forense append-only y elevación JIT — ver mapeo abajo.

## Cómo correrlo

```bash
# 1. Base de datos (crea schema, triggers, RLS y datos seed automáticamente)
cp .env.example .env   # completá POSTGRES_PASSWORD y APP_DB_PASSWORD (secretos, no se versionan)
docker compose up -d

# 2. API
cd server
cp .env.example .env   # completá PAYMENT_KEY; PGPASSWORD debe ser igual al APP_DB_PASSWORD del paso 1
npm install
npm run dev        # http://localhost:3001

# 3. Cliente
cd client
npm install
npm run dev        # http://localhost:5173
```

No hace falta el paso manual: cada entorno genera los `.env` con secretos al azar y
consistentes.

Un solo comando que levanta DB + API + cliente (Ctrl+C frena todo):

```powershell
.\start.ps1            # Windows   (-Reset recrea la DB; -NoLogs en segundo plano)
```
```bash
./startLinux.sh        # Linux/Mac (--reset recrea la DB; --no-logs en segundo plano)
```

**Linux/Mac, alternativa con `make`** (targets compuestos, ver `make help`):

```bash
make install   # una vez: deps de server y client
make up        # genera .env + levanta la DB (schema, RLS y cuentas demo)
make seed      # catálogo completo (~100 listings con imágenes; opcional)
make api       # API en :3001  (en una terminal; Ctrl+C frena)
make web       # cliente en :5173 (en otra terminal; Ctrl+C frena)
make test      # suite de integración m9
make down      # frena la DB (mantiene datos)  ·  make reset = recrear desde cero
```

> `startLinux.sh` es el equivalente a `start.ps1`: cómodo, todo en uno. `make` es la vía
> granular — al correr los dev-servers en foreground (`make api` / `make web`), frenarlos
> es un `Ctrl+C` nativo, sin depender de rastrear PIDs ni de `lsof`.

### Datos de ejemplo (dos seeds distintos)

- **Automático**: al inicializar la DB por primera vez (volumen vacío), Postgres corre
  los scripts de `db/init/` — incluido `04_seed.sql`, que carga las **cuentas demo** (ver
  tabla abajo) y unos pocos listings base. No requiere ningún paso extra: `docker compose
  up -d` (o `.\start.ps1`) ya los crea.
- **Manual**: el catálogo completo (~100 listings con imágenes) lo carga `server/seed.mjs`,
  que **no** corre solo. Ejecutá `.\seed.ps1` (o `node server/seed.mjs`) con la DB levantada.

**Tests de integración** (29 checks, requiere la app corriendo):

```bash
node server/tests/m9.mjs
```

Usuarios demo (password `password123`):

| Usuario | Rol |
|---|---|
| `ana_buyer` | Usuario (compra y vende) |
| `bruno_buyer` | Usuario |
| `carla_sells` | Usuario |
| `dario_sells` | Usuario |
| `mod_mati` | Moderador de disputas |
| `admin_root` | Administrador |

> Los nombres `*_buyer` / `*_sells` son históricos: todos son cuentas `user` con los mismos permisos. El registro público crea siempre una cuenta `user`.

## Mapeo de temas de los TPs

### TP1 — Patrones de acceso (Repository)
Toda la persistencia pasa por repositorios en
[server/src/repositories/](server/src/repositories/): la lógica de negocio trata
la base como una colección y nunca arma SQL fuera de esa capa.

### TP3 — RBAC vs. ABAC (RLS)
- **RBAC** en la capa de aplicación: middleware [`requireRole`](server/src/auth.js).
- **ABAC** en la base: políticas de Row Level Security en
  [db/init/03_security.sql](db/init/03_security.sql). El acceso de un moderador a
  una disputa evalúa atributos de **sujeto** (`app.user_id`, `app.role`),
  **recurso** (la disputa y sus participantes) y **entorno**
  (`expires_at > now()` del grant JIT). El rol solo no alcanza.

### TP4 — Criptografía y enmascaramiento
- **Hashing** de contraseñas con `pgcrypto`: `crypt(pass, gen_salt('bf', 10))`
  ([userRepository.js](server/src/repositories/userRepository.js)). Los tokens de
  sesión se guardan como SHA-256, nunca en claro.
- **DDM**: el comprador nunca ve el email real del vendedor — vista
  `v_listings_public` con `mask_email()` (mismo principio que la extensión
  `anon`: el dato real queda intacto en disco, se ofusca al vuelo).
- **TDE (a nivel columna)**: los datos de pago se cifran en reposo con
  `pgp_sym_encrypt` ([paymentRepository.js](server/src/repositories/paymentRepository.js)).
  Vanilla Postgres no trae TDE nativo; en producción se usaría `pg_tde` o cifrado
  de volumen para los backups físicos.

### TP5 — Programación defensiva contra SQLi
Todas las consultas son **parametrizadas** (`$1, $2, ...` con `pg`); cero
concatenación de strings. Defensa en profundidad: validación de entrada en rutas,
manejo de errores que no filtra detalles del motor.

### TP6 — Hardening (CIS)
- La API se conecta como `lootmarket_app`: rol de **mínimo privilegio**, sin
  ownership, sin `DROP`, sin superuser.
- Postgres publicado solo en `127.0.0.1` (equivalente a `listen_addresses`
  restringido) — [docker-compose.yml](docker-compose.yml).
- El contenedor corre el motor como usuario `postgres`, nunca root.

### TP7 — Forensia
Triggers de auditoría ([db/init/02_audit.sql](db/init/02_audit.sql)) capturan
**before/after image**, actor y timestamp de cada operación sobre listings,
transacciones, transferencias, disputas y grants JIT — análogo a la Before Image
del transaction log de SQL Server, pero materializada en una tabla `audit_log`
**append-only** (triggers bloquean UPDATE/DELETE).

**Caso forense principal**: el admin entra a *Auditoría* → "Rastrear transacción"
y reconstruye la cadena completa de una transacción disputada: quién listó el
ítem, quién lo compró, si se transfirió, y si hubo modificación posterior del
precio o estado (`GET /api/admin/audit/transaction/:id`).

### TP8 — Zero Trust / JIT
Los moderadores **no tienen acceso permanente** a los datos privados de las
disputas. Flujo JIT:

1. El moderador ve solo metadatos (vista `disputes_summary`).
2. Solicita elevación con **motivo obligatorio** → fila en `jit_grants` con
   `expires_at = now() + 15 min`.
3. La política RLS `p_disputes_moderator_jit` concede acceso únicamente mientras
   el grant esté vigente y no revocado. **Expiración automática**: pasados los
   15 minutos, la misma query devuelve 0 filas.
4. Cada elevación queda en `audit_log` (trazabilidad forzada, imposible negar la
   acción post-incidente).

## Flujo de escrow

```
active ──compra──▶ escrow_held ──vendedor transfiere──▶ item_transferred
                       │                                      │
                       │                            comprador confirma
                    disputa                                   │
                       ▼                                      ▼
                   disputed ──moderador (JIT)──▶ refunded | released
```
