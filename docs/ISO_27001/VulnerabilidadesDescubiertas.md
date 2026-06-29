# Vulnerabilidades Descubiertas — Auditoría ISO/IEC 27001:2022

**Proyecto:** LootMarket — Marketplace de Gaming
**Marco:** ISO/IEC 27001:2022, Anexo A (controles técnicos — Matriz 3 de la lista de verificación)
**Fecha:** 2026-06-29
**Alcance:** API (Node/Express), base PostgreSQL 16, cliente React. Auditoría de código y configuración (gap analysis técnico, cláusula 9.2 + Anexo A).

> **Nota de método.** Esta auditoría es un *análisis de brechas técnico* sobre el Anexo A.
> No reemplaza la documentación obligatoria del SGSI (SoA, política, evaluación de
> riesgos — cláusulas 4 a 10), que para un trabajo académico están fuera de alcance.

---

## Resumen ejecutivo

| ID | Severidad | Hallazgo | Control Anexo A | Estado |
|----|-----------|----------|-----------------|--------|
| V1 | **Crítica** | Clave de cifrado de pagos hardcodeada en el código | A.8.24 | ✅ Corregido |
| V2 | Alta | Credenciales de DB hardcodeadas (código + compose + SQL) | A.5.17 / A.8.9 | ✅ Corregido |
| V3 | Alta | CORS abierto a cualquier origen (`*`) | A.8.20 / A.8.23 | ✅ Corregido |
| V4 | Media | Login sin límite de intentos ni registro de fallos | A.8.5 / A.8.16 | ✅ Corregido |
| V5 | Media | Sin cabeceras de seguridad; `X-Powered-By` expuesto | A.8.9 | ✅ Corregido |
| V6 | Media | RLS de `notifications` permite forjar notificaciones | A.8.3 | 📋 Recomendación |
| V7 | Baja | Política de contraseñas débil (mín. 6, sin complejidad) | A.8.5 / A.5.17 | 📋 Recomendación |
| V8 | Baja | Token de sesión en `localStorage` (exfiltrable por XSS) | A.8.28 | 📋 Recomendación |

**Lo que ya estaba bien (no son hallazgos):** parametrización total contra SQLi (A.8.28),
RLS/ABAC sobre datos sensibles (A.8.3), hashing bcrypt de contraseñas (A.8.24),
DDM de emails (A.8.11), auditoría append-only (A.8.15/A.8.16), elevación JIT con
expiración (A.8.2/A.8.18), rol de mínimo privilegio y DB bindeada a loopback (A.8.9).

---

## V1 — CRÍTICA: clave de cifrado de pagos hardcodeada en el código

**Control:** A.8.24 (Uso de criptografía). **Tríada CIA:** Confidencialidad.

Los números de tarjeta se cifran en reposo con `pgp_sym_encrypt` (TP4). El problema:
la clave simétrica que protege **todos** los PAN vivía en el repositorio con un valor
por defecto. Quien tuviera acceso al código + un dump de la DB podía descifrar todas
las tarjetas — el cifrado en reposo no protegía nada.

### Antes — `server/src/db.js`
```js
export const PAYMENT_KEY = process.env.PAYMENT_KEY || 'tde_demo_key_change_me';
```

### Después — `server/src/db.js`
```js
// Fail-closed: sin PAYMENT_KEY la API no arranca (en produccion: KMS/Vault).
export const PAYMENT_KEY = process.env.PAYMENT_KEY;
if (!PAYMENT_KEY) {
  throw new Error(
    'PAYMENT_KEY no esta definida. Exportala antes de iniciar la API ' +
    '(ver server/.env.example). La clave de cifrado de pagos no debe vivir en el codigo.'
  );
}
```

**Soporte:** `server/.env.example` documenta la variable; `server/.env` está en
`.gitignore`; `server/src/env.js` la carga antes de evaluar `db.js`; `start.ps1` genera
una `PAYMENT_KEY` aleatoria de 256 bits si falta.

> El cifrado nunca se *descifra* en el código (solo se guarda + se muestra `last4`),
> así que rotar la clave no rompe funcionalidad existente.

---

## V2 — ALTA: credenciales de base de datos hardcodeadas

**Control:** A.5.17 (Información de autenticación) / A.8.9 (Gestión de configuración).

Tres passwords en texto plano commiteadas: el rol `lootmarket_app` en
`03_security.sql` y `db.js`, y el superusuario `postgres` en `docker-compose.yml`.

### Antes
```sql
-- 03_security.sql
CREATE ROLE lootmarket_app LOGIN PASSWORD 'app_secret_change_me';
```
```js
// db.js
password: process.env.PGPASSWORD || 'app_secret_change_me',
```
```yaml
# docker-compose.yml
POSTGRES_PASSWORD: postgres_admin_change_me
```

### Después
Las passwords salen del código a un `.env` raíz (gitignored). El rol se crea en un
init-script que lee la password del entorno; compose falla si no está definida (sin
default); `db.js` exige `PGPASSWORD`.

```sh
# db/init/00_roles.sh (corre antes que los .sql en el primer init)
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD no definida (configurala en el .env raiz)}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE lootmarket_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
EOSQL
```
```sql
-- 03_security.sql: ya no crea el rol, solo otorga privilegios
GRANT CONNECT ON DATABASE lootmarket TO lootmarket_app;
```
```yaml
# docker-compose.yml: sin defaults; ':?' aborta si falta el secreto
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defini POSTGRES_PASSWORD en el .env raiz}
APP_DB_PASSWORD: ${APP_DB_PASSWORD:?defini APP_DB_PASSWORD en el .env raiz}
```
```js
// db.js: fail-closed, sin literal
if (!process.env.PGPASSWORD) { throw new Error('PGPASSWORD no esta definida...'); }
password: process.env.PGPASSWORD,
```

**Soporte:** `.env.example` (raíz) documenta `POSTGRES_PASSWORD` y `APP_DB_PASSWORD`;
`start.ps1` genera ambas al azar (manteniendo `APP_DB_PASSWORD == PGPASSWORD`) antes
del `docker compose up`; `.gitattributes` fuerza LF en `*.sh` para que el init-script
corra en el contenedor Linux.

**Verificado end-to-end:** en un contenedor `postgres:16` desechable, `00_roles.sh`
creó el rol desde `$APP_DB_PASSWORD` y `lootmarket_app` conectó con esa password
viendo los datos vía RLS.

> Único residual: tras este cambio, un volumen `pgdata` ya inicializado con la
> password vieja da `28P01 password authentication failed` (el init solo corre en
> base vacía). Se resuelve una sola vez con `docker compose down -v` o el atajo
> `.\start.ps1 -Reset`. Un clone limpio no tiene volumen previo, así que no aplica.

---

## V3 — ALTA: CORS abierto a cualquier origen

**Control:** A.8.20 (Seguridad de redes) / A.8.23 (Filtrado web).

`app.use(cors())` emitía `Access-Control-Allow-Origin: *`.

### Antes — `server/src/index.js`
```js
const app = express();
app.use(cors());
```

### Después — `server/src/index.js`
```js
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
}));
```

---

## V4 — MEDIA: login sin límite de intentos ni registro de fallos

**Control:** A.8.5 (Autenticación segura) / A.8.16 (Monitoreo de actividades).

### Antes — `server/src/routes/auth.js`
```js
authRoutes.post('/login', async (req, res, next) => {
  const user = await userRepository.verifyCredentials(username, password);
  if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
  ...
});
```

### Después — `server/src/routes/auth.js`
Middleware `loginRateLimit` (10 intentos / 15 min por IP+usuario → HTTP 429) y
`recordLoginFailure` que registra cada fallo (`[SECURITY] intento de login fallido`).
```js
authRoutes.post('/login', loginRateLimit, async (req, res, next) => {
  const user = await userRepository.verifyCredentials(username, password);
  if (!user) {
    recordLoginFailure(req._loginKey);
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }
  loginAttempts.delete(req._loginKey);
  ...
});
```

> In-memory (una instancia). En producción: Redis/WAF y envío de los eventos
> `[SECURITY]` a un SIEM (A.8.16).

---

## V5 — MEDIA: faltan cabeceras de seguridad; banner del servidor expuesto

**Control:** A.8.9 (Gestión de configuración — hardening).

### Antes
`X-Powered-By: Express`, sin cabeceras defensivas.

### Después — `server/src/index.js`
```js
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
```

---

## V6 — MEDIA: la RLS de `notifications` permite forjar notificaciones (recomendación)

**Control:** A.8.3 (Restricción del acceso a la información) — integridad.

La política de INSERT es `WITH CHECK (true)`: cualquier sesión con el rol de app puede
insertar una notificación para **cualquier** `user_id`. Hoy mitigado porque no hay ruta
pública de INSERT, pero como defensa en profundidad la regla es demasiado laxa.

### Antes — `db/init/03_security.sql`
```sql
CREATE POLICY p_notif_insert ON notifications FOR INSERT WITH CHECK (true);
```

### Después (propuesto)
El servidor notifica a *otro* usuario (comprador → vendedor), así que no sirve
`user_id = app_user_id()`. La corrección correcta es encapsular el insert en una función
`SECURITY DEFINER` (propiedad de `postgres`, que bypassa RLS) y restringir el INSERT directo:
```sql
CREATE POLICY p_notif_insert ON notifications
    FOR INSERT WITH CHECK (user_id = app_user_id());

CREATE FUNCTION notify_user(p_uid int, p_kind text, p_msg text, p_link text)
RETURNS void AS $$
    INSERT INTO notifications(user_id, kind, message, link)
    VALUES (p_uid, p_kind, p_msg, p_link);
$$ LANGUAGE sql SECURITY DEFINER;
```
y `notificationRepository.notify()` llamaría a `SELECT notify_user($1,$2,$3,$4)`.

> No se aplicó automáticamente para no arriesgar el flujo de escrow sin correr la suite
> de integración (`server/tests/m9.mjs`) contra una DB recreada. Acción correctiva
> priorizada (cláusula 10.1).

---

## V7 — BAJA: política de contraseñas débil (recomendación)

**Control:** A.8.5 / A.5.17. `auth.js` exige solo 6 caracteres, sin complejidad ni
chequeo contra contraseñas comprometidas. Recomendación: mínimo 10–12 y validar contra
una lista de filtradas (k-anonymity de HIBP).

## V8 — BAJA: token de sesión en `localStorage` (recomendación)

**Control:** A.8.28. `client/src/api.js` guarda el token en `localStorage`, exfiltrable
por cualquier XSS. Recomendación: cookie `HttpOnly` + `SameSite=Strict` + CSRF token.

---

## Controles del Anexo A ya satisfechos (evidencia para el SoA)

| Control | Evidencia en el código |
|---|---|
| A.8.28 Codificación segura (anti-SQLi) | Todo SQL parametrizado (`$1,$2…`); cero concatenación. |
| A.8.3 Restricción de acceso | RLS + `FORCE ROW LEVEL SECURITY` en disputes, payments, transactions, listings, notifications. |
| A.8.2 Acceso privilegiado / A.8.18 | Elevación JIT con expiración 15 min y motivo obligatorio (`jit_grants`). |
| A.8.24 Criptografía | bcrypt en contraseñas; tokens en SHA-256; pagos con `pgp_sym_encrypt`. |
| A.8.11 Enmascaramiento de datos | `mask_email()` + vista `v_listings_public` (DDM). |
| A.8.15/A.8.16 Registro y monitoreo | `audit_log` append-only con before/after image y actor. |
| A.8.9 Gestión de configuración | Rol de mínimo privilegio; Postgres solo en `127.0.0.1`; motor no-root; secretos fuera del repo. |

---

## Cómo verificar las correcciones

```bash
# V1: sin clave la API se niega a arrancar
cd server
node -e "import('./src/db.js').catch(e => console.log('OK bloquea:', e.message))"

# V2 (end-to-end, sin tocar tu DB): contenedor desechable
docker run -d --name lm_test -e POSTGRES_DB=lootmarket -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=x -e APP_DB_PASSWORD=apppass \
  -v "$PWD/db/init:/docker-entrypoint-initdb.d:ro" -p 55432:5432 postgres:16
# luego: docker exec lm_test psql -U postgres -d lootmarket -tAc \
#   "SELECT rolname FROM pg_roles WHERE rolname='lootmarket_app'"   -> lootmarket_app
docker rm -f lm_test
```
Con la app corriendo: >10 logins fallidos → HTTP 429 (V4); la respuesta no trae
`X-Powered-By` y sí `X-Content-Type-Options: nosniff` (V5); un `fetch` desde un origen
distinto a `localhost:5173` es rechazado (V3).
```bash
node server/tests/m9.mjs   # 26 casos de uso (correr con la app levantada)
```
