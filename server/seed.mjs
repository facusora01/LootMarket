// Seed masivo de listings con imagenes reales (CDNs verificados).
// Idempotente: se puede correr varias veces sin duplicar.
// Corre como superuser (postgres) porque agrega la columna image_url y
// recrea la vista v_listings_public (DDL que lootmarket_app no puede hacer).
//
// Uso:  node seed.mjs            (desde server/)
//       o via ../seed.ps1 / ../seed.sh
import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'db', 'seed', 'listings.json');

const client = new pg.Client({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'lootmarket',
  // superuser para el DDL; override con PGSEEDUSER/PGSEEDPASSWORD si hace falta
  user: process.env.PGSEEDUSER || 'postgres',
  password: process.env.PGSEEDPASSWORD || 'postgres_admin_change_me',
});

async function main() {
  const raw = JSON.parse(await readFile(SEED_FILE, 'utf-8'));
  const { sellers, listings } = raw;
  await client.connect();

  // Actor para el trigger de auditoria (TP7), igual que 04_seed.sql
  await client.query("SELECT set_config('app.user_id', 'seed', false)");

  // 1) Migracion idempotente: columna de imagen + vista publica al dia.
  await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url TEXT');
  await client.query(`
    CREATE OR REPLACE VIEW v_listings_public AS
    SELECT l.id, l.title, l.category, l.description, l.price, l.status,
           l.created_at, l.updated_at,
           u.username AS seller_username,
           mask_email(u.email) AS seller_email_masked,
           l.image_url
    FROM listings l
    JOIN users u ON u.id = l.seller_id;
  `);
  await client.query('GRANT SELECT ON v_listings_public TO lootmarket_app');

  // 2) Vendedores nuevos (password123, hash bcrypt via pgcrypto). No pisa existentes.
  for (const s of sellers) {
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, crypt('password123', gen_salt('bf', 10)), 'seller')
       ON CONFLICT (username) DO NOTHING`,
      [s.username, s.email]
    );
  }

  // 3) Mapa username -> id (incluye carla_sells / dario_sells ya existentes)
  const usernames = [...new Set(listings.map((l) => l.seller))];
  const { rows } = await client.query(
    'SELECT id, username FROM users WHERE username = ANY($1)',
    [usernames]
  );
  const idByName = Object.fromEntries(rows.map((r) => [r.username, r.id]));

  // 4) Insert idempotente: salta si ya existe (mismo titulo + vendedor).
  let inserted = 0, skipped = 0;
  for (const l of listings) {
    const sellerId = idByName[l.seller];
    if (!sellerId) { console.warn(`! vendedor no encontrado: ${l.seller} (salteo "${l.title}")`); continue; }
    const res = await client.query(
      `INSERT INTO listings (seller_id, title, category, description, price, image_url, status)
       SELECT $1::int, $2::text, $3::listing_category, $4::text, $5::numeric, $6::text, 'active'::listing_status
       WHERE NOT EXISTS (
         SELECT 1 FROM listings WHERE title = $2::text AND seller_id = $1::int
       )`,
      [sellerId, l.title, l.category, l.description, l.price, l.image_url]
    );
    if (res.rowCount > 0) inserted++; else skipped++;
  }

  console.log(`\nSeed OK -> insertados: ${inserted} | ya existian: ${skipped} | vendedores: ${sellers.length}`);
  await client.end();
}

main().catch(async (e) => {
  console.error('Seed FALLO:', e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
