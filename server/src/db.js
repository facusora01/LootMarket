import pg from 'pg';

// TP6: la API se conecta con lootmarket_app (minimo privilegio), nunca postgres.
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'lootmarket',
  user: process.env.PGUSER || 'lootmarket_app',
  password: process.env.PGPASSWORD || 'app_secret_change_me',
});

// Clave simetrica para cifrado de datos de pago en reposo (TP4, TDE a nivel columna).
// En produccion: KMS/Vault, jamas hardcodeada.
export const PAYMENT_KEY = process.env.PAYMENT_KEY || 'tde_demo_key_change_me';

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
