import pg from 'pg';

// ISO 27001 A.5.17 / A.8.24: los secretos NO viven en el codigo fuente.
// Se cargan de variables de entorno; ver server/.env.example y start.ps1.

// TP6: la API se conecta con lootmarket_app (minimo privilegio), nunca postgres.
// A.5.17: la password se toma del entorno (server/.env), no del codigo. Fail-closed.
if (!process.env.PGPASSWORD) {
  throw new Error(
    'PGPASSWORD no esta definida. Configurala en server/.env (ver server/.env.example); ' +
    'debe coincidir con APP_DB_PASSWORD del .env raiz.'
  );
}
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'lootmarket',
  user: process.env.PGUSER || 'lootmarket_app',
  password: process.env.PGPASSWORD,
});

// Clave simetrica para cifrado de datos de pago en reposo (TP4, TDE a nivel columna).
// ISO 27001 A.8.24 (uso de criptografia): la clave es el secreto que protege todos
// los PAN cifrados — si vive en el repo, el cifrado en reposo no protege nada.
// Fail-closed: sin PAYMENT_KEY la API no arranca (en produccion: KMS/Vault).
export const PAYMENT_KEY = process.env.PAYMENT_KEY;
if (!PAYMENT_KEY) {
  throw new Error(
    'PAYMENT_KEY no esta definida. Exportala antes de iniciar la API ' +
    '(ver server/.env.example). La clave de cifrado de pagos no debe vivir en el codigo.'
  );
}

/**
 * Ejecuta `fn(client)` dentro de una transaccion con el contexto de identidad
 * seteado via set_config. Las policies RLS (TP3/TP8) y el trigger de auditoria
 * (TP7) leen app.user_id / app.role de aca.
 */
export async function withUserContext(user, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)",
      [user ? String(user.id) : '', user ? user.role : '']
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
