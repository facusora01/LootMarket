# Mapeo de TPs → archivos (LootMarket)

Guía de "dónde está cada cosa y cómo se hace". Para cada TP: el concepto, el
archivo exacto donde vive, el objeto concreto (función / policy / vista /
endpoint) y cómo demostrarlo.

Rutas relativas a la raíz del repo. Resumen narrativo en el [README](../README.md).

| TP | Tema | Archivos clave |
|----|------|----------------|
| TP1 | Patrón Repository | [server/src/repositories/](../server/src/repositories/) |
| TP3 | RBAC vs ABAC (RLS) | [auth.js](../server/src/auth.js), [03_security.sql](../db/init/03_security.sql) |
| TP4 | Cripto + enmascaramiento | [userRepository.js](../server/src/repositories/userRepository.js), [paymentRepository.js](../server/src/repositories/paymentRepository.js), [03_security.sql](../db/init/03_security.sql) |
| TP5 | SQLi defensiva | todos los repositorios + [routes/](../server/src/routes/) |
| TP6 | Hardening (CIS) | [03_security.sql](../db/init/03_security.sql), [db.js](../server/src/db.js), [docker-compose.yml](../docker-compose.yml) |
| TP7 | Forensia | [02_audit.sql](../db/init/02_audit.sql), [auditRepository.js](../server/src/repositories/auditRepository.js), [routes/admin.js](../server/src/routes/admin.js) |
| TP8 | Zero Trust / JIT | [01_schema.sql](../db/init/01_schema.sql), [03_security.sql](../db/init/03_security.sql), [disputeRepository.js](../server/src/repositories/disputeRepository.js) |

El "puente" que conecta la app con la base es
[withUserContext()](../server/src/db.js) en [db.js](../server/src/db.js): abre una
transacción y setea `app.user_id` / `app.role` con `set_config(...)`. De ahí leen
**las policies RLS (TP3/TP8)** y **el trigger de auditoría (TP7)**. Si entendés esa
función, entendés cómo se enchufa todo el resto.

---

## TP1 — Patrón Repository

**Qué.** Toda la persistencia pasa por una capa de repositorios; la lógica de
negocio trata la base como una colección y nunca arma SQL fuera de ahí.

**Dónde.** [server/src/repositories/](../server/src/repositories/)
- [userRepository.js](../server/src/repositories/userRepository.js) — usuarios, sesiones
- [listingRepository.js](../server/src/repositories/listingRepository.js) — publicaciones
- [transactionRepository.js](../server/src/repositories/transactionRepository.js) — escrow
- [disputeRepository.js](../server/src/repositories/disputeRepository.js) — disputas + JIT
- [paymentRepository.js](../server/src/repositories/paymentRepository.js) — medios de pago
- [auditRepository.js](../server/src/repositories/auditRepository.js) — consultas forenses

**Cómo se hace.** Cada repo exporta un objeto con métodos tipo colección
(`create`, `verifyCredentials`, `open`, `resolve`, ...). Las rutas
([routes/](../server/src/routes/)) solo hacen HTTP in/out y delegan; el SQL vive
únicamente en el repo. Ningún `route` arma queries.

**Cómo se prueba.** `grep -rEn "SELECT|INSERT|UPDATE|DELETE" server/src/routes/`
no devuelve nada: el SQL está 100% en repositorios.

---

## TP3 — RBAC vs ABAC (Row Level Security)

**Qué.** Dos capas de control de acceso. RBAC (rol) en la app; ABAC (atributos
de sujeto + recurso + entorno) en la base con RLS. El rol solo no alcanza para
los datos sensibles.

**Dónde / cómo.**

- **RBAC** — [auth.js](../server/src/auth.js), función
  [requireRole()](../server/src/auth.js): middleware Express que corta con 403 si
  `req.user.role` no está en la lista. Ej: `requireRole('user', 'admin')` para
  publicar/editar/borrar en [routes/listings.js](../server/src/routes/listings.js),
  o `requireRole('moderator', 'admin')` para el panel de disputas. Roles:
  `user` (compra y vende), `moderator`, `admin`.

- **ABAC / RLS** — [03_security.sql](../db/init/03_security.sql) sobre la tabla
  `disputes` (`ENABLE` + `FORCE ROW LEVEL SECURITY`). Policies:
  - `p_disputes_participants` — comprador/vendedor ven su propia disputa.
  - `p_disputes_moderator_jit` — moderador **solo** con grant JIT vigente (ver TP8).
  - `p_disputes_admin` — admin ve todo (supervisión).
  - `p_disputes_insert` / `p_disputes_update_mod` — escrituras.
  - `p_payment_owner` sobre `payment_methods` — cada uno ve solo lo suyo.

- **Helpers** `app_user_id()` / `app_role()` en
  [03_security.sql](../db/init/03_security.sql): leen el GUC de sesión con
  `current_setting(..., true)` y normalizan con `NULLIF(..., '')` (en pools el GUC
  puede volver `''` y no `NULL` tras el commit → `''::int` rompería sin el NULLIF).

**Cómo se prueba.** Un moderador pide `GET /api/disputes/:id` sin grant → RLS
devuelve 0 filas → 403. Con grant vigente, la misma query devuelve la fila. El
rol no cambió: cambió el atributo de entorno.

---

## TP4 — Criptografía y enmascaramiento

**Qué.** Contraseñas hasheadas, tokens hasheados, email enmascarado para el
comprador (DDM) y datos de pago cifrados en reposo (TDE a nivel columna).

**Dónde / cómo.**

- **Hashing de password** — [userRepository.js](../server/src/repositories/userRepository.js):
  `create()` usa `crypt($3, gen_salt('bf', 10))` (bcrypt vía `pgcrypto`).
  Login: `verifyCredentials()` compara con
  `password_hash = crypt($input, password_hash)`. Nunca hay texto plano.

- **Tokens de sesión** — mismo archivo: `createSession()` genera el token con
  `crypto.randomBytes(32)`, lo manda al cliente, pero en `sessions.token_hash`
  guarda solo su **SHA-256**. `findBySessionToken()` busca por el hash.

- **DDM (email)** — [03_security.sql](../db/init/03_security.sql): función
  `mask_email()` + vista `v_listings_public` que expone `seller_email_masked`.
  El dato real queda intacto en disco; se ofusca al vuelo (mismo principio que la
  extensión `anon`, que Postgres vanilla no trae).

- **TDE a nivel columna (pagos)** — [paymentRepository.js](../server/src/repositories/paymentRepository.js):
  `add()` guarda la tarjeta con `pgp_sym_encrypt($card, $key)` en `card_encrypted`
  (BYTEA) + solo `card_last4` para la UI. La clave es `PAYMENT_KEY` en
  [db.js](../server/src/db.js) (en prod iría a KMS/Vault). Postgres vanilla no trae
  TDE nativo; esto cifra la columna sensible.

**Cómo se prueba.** En la DB: `SELECT password_hash FROM users` → hash bcrypt;
`SELECT token_hash FROM sessions` → sha256; `SELECT card_encrypted FROM
payment_methods` → bytea ilegible. En la API pública el email del vendedor llega
enmascarado (`an****@...`).

---

## TP5 — Programación defensiva contra SQLi

**Qué.** Cero concatenación de SQL: todo parametrizado. Validación de entrada y
errores que no filtran el motor.

**Dónde / cómo.** Todos los repositorios usan placeholders `$1, $2, ...` con el
driver `pg` (ver cualquier query en
[userRepository.js](../server/src/repositories/userRepository.js) o
[disputeRepository.js](../server/src/repositories/disputeRepository.js)). La
validación de entrada vive en las rutas (ej. motivo JIT obligatorio en
[routes/disputes.js](../server/src/routes/disputes.js), `winner ∈ {buyer,seller}`
en `resolve`). El handler de errores global en
[index.js](../server/src/index.js) responde genérico sin volcar detalles del
motor.

**Cómo se prueba.** Mandar `' OR 1=1 --` (y similares) en login/búsqueda: se
tratan como literal, no hay bypass ni error que revele estructura.

---

## TP6 — Hardening (CIS / mínimo privilegio)

**Qué.** La superficie de ataque reducida: rol de app sin privilegios de más, red
mínima, motor sin root.

**Dónde / cómo.**

- **Rol de mínimo privilegio** — [03_security.sql](../db/init/03_security.sql):
  `CREATE ROLE lootmarket_app LOGIN` con solo `SELECT/INSERT/UPDATE` sobre las
  tablas (DELETE únicamente en `sessions` para logout). Sin ownership, sin DROP,
  sin superuser. Sobre `audit_log`: `REVOKE UPDATE, DELETE`.
- **La API usa ese rol** — [db.js](../server/src/db.js): el pool se conecta como
  `lootmarket_app`, nunca `postgres`.
- **Red mínima / motor sin root** — [docker-compose.yml](../docker-compose.yml):
  Postgres publicado solo en `127.0.0.1` y el contenedor corre el engine como
  usuario `postgres`.

**Cómo se prueba.** Conectado como `lootmarket_app`, un `DROP TABLE` o `DELETE
FROM audit_log` falla por permisos.

---

## TP7 — Forensia (auditoría append-only)

**Qué.** Cada operación sensible deja before/after image, actor y timestamp en un
log que nadie puede reescribir. Caso estrella: reconstruir una transacción
disputada de punta a punta.

**Dónde / cómo.**

- **Trigger de auditoría** — [02_audit.sql](../db/init/02_audit.sql): función
  `fn_audit()` (genérica) inserta en `audit_log` el `TG_OP`, `to_jsonb(OLD)` como
  `before_img`, `to_jsonb(NEW)` como `after_img` y el actor desde
  `current_setting('app.user_id', true)`. Triggers `AFTER INSERT/UPDATE/DELETE`
  sobre `listings`, `transactions`, `item_transfers`, `disputes`, `jit_grants`.
- **Append-only** — mismo archivo: `fn_audit_immutable()` lanza excepción y el
  trigger `trg_audit_log_immutable` (`BEFORE UPDATE OR DELETE`) bloquea toda
  modificación de `audit_log`. Reforzado por el `REVOKE` del TP6.
- **Tabla** — `audit_log` en [01_schema.sql](../db/init/01_schema.sql)
  (`before_img`/`after_img` JSONB, `actor_id`, `at`).
- **Caso forense** — [auditRepository.js](../server/src/repositories/auditRepository.js),
  `traceTransaction()`: junta del `audit_log` el listado, la compra, las
  transferencias, la disputa y los grants JIT de esa transacción, ordenado por
  tiempo. Expuesto en `GET /api/admin/audit/transaction/:id`
  ([routes/admin.js](../server/src/routes/admin.js), tras `requireRole('admin')`).

**Cómo se prueba (demo principal).** Login como `admin_root` → Auditoría →
"Rastrear transacción" sobre una transacción disputada: aparece la cadena
completa (quién listó, quién compró, si se transfirió, cambios de precio/estado).
Intentar `UPDATE audit_log ...` → error *"audit_log es append-only"*.

---

## TP8 — Zero Trust / JIT (Just-In-Time)

**Qué.** El moderador no tiene acceso permanente a los datos privados de una
disputa. Pide elevación con motivo, recibe acceso acotado a **esa** disputa por
**15 minutos**, y expira solo. Todo queda auditado.

**Dónde / cómo.**

- **Tabla** — `jit_grants` en [01_schema.sql](../db/init/01_schema.sql)
  (`moderator_id`, `dispute_id`, `reason`, `expires_at`, `revoked`). Índice parcial
  `idx_jit_active` para grants no revocados.
- **Pedir elevación** — [disputeRepository.js](../server/src/repositories/disputeRepository.js),
  `requestJit()`: inserta el grant con `expires_at = now() + interval '15 minutes'`.
  Endpoint `POST /api/disputes/:id/jit` con **motivo obligatorio**
  ([routes/disputes.js](../server/src/routes/disputes.js): 400 si falta `reason`).
- **La policy que lo hace cumplir** — `p_disputes_moderator_jit` en
  [03_security.sql](../db/init/03_security.sql): concede `SELECT` solo si
  `app_role() = 'moderator'` **y** existe un `jit_grant` para esa disputa, no
  revocado y con `expires_at > now()`. El `now()` es el atributo de **entorno**:
  pasados los 15 min la misma query devuelve 0 filas, sin job externo.
- **Solo metadatos sin elevación** — vista `disputes_summary` en
  [03_security.sql](../db/init/03_security.sql) (corre como owner, expone solo
  columnas no sensibles); el listado del moderador usa `listOpenSummaries()`.
- **Auditado** — al ser `jit_grants` una tabla con trigger (TP7), cada elevación
  queda en `audit_log`: imposible negar la acción post-incidente.

**Cómo se prueba.** Login `mod_mati`: el listado de disputas muestra metadatos
pero `GET /api/disputes/:id` da 403. Tras `POST /api/disputes/:id/jit` con motivo,
el detalle se ve. Forzando `expires_at` al pasado (o esperando 15 min), vuelve a
dar 0 filas.

---

## Flujo de escrow (contexto del negocio)

Estados en `transactions.status`
([01_schema.sql](../db/init/01_schema.sql)), lógica en
[transactionRepository.js](../server/src/repositories/transactionRepository.js) /
[disputeRepository.js](../server/src/repositories/disputeRepository.js):

```
escrow_held ──vendedor transfiere──▶ item_transferred ──comprador confirma──▶ released
     │                                      │
   disputa                               disputa
     ▼                                      ▼
 disputed ──moderador (JIT) resuelve──▶ refunded | released
```

Endpoints en [routes/transactions.js](../server/src/routes/transactions.js):
`POST /` (comprar), `/:id/transfer`, `/:id/release`, `/:id/dispute`,
`GET /mine`.
