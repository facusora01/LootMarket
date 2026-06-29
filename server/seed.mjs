// Seed masivo de listings con imagenes reales (CDNs verificados).
// Idempotente: se puede correr varias veces sin duplicar.
// Corre como superuser (postgres) porque agrega la columna image_url y
// recrea la vista v_listings_public (DDL que lootmarket_app no puede hacer).
//
// Uso:  node seed.mjs            (desde server/)
//       o via ../seed.ps1 / ../seed.sh
import pg from 'pg';
import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'db', 'seed', 'listings.json');

// Carga el .env raiz (A.5.17: el password del superuser no vive en el codigo).
// Es el mismo POSTGRES_PASSWORD que usa docker-compose para inicializar la DB.
const ROOT_ENV = join(__dirname, '..', '.env');
if (existsSync(ROOT_ENV)) {
  for (const line of readFileSync(ROOT_ENV, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim();
  }
}

const seedPassword = process.env.PGSEEDPASSWORD || process.env.POSTGRES_PASSWORD;
if (!seedPassword) {
  console.error('Falta POSTGRES_PASSWORD (o PGSEEDPASSWORD). Configurala en el .env raiz.');
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'lootmarket',
  // superuser para el DDL; toma el password del .env raiz, nunca hardcodeado
  user: process.env.PGSEEDUSER || 'postgres',
  password: seedPassword,
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
       VALUES ($1, $2, crypt('password123', gen_salt('bf', 10)), 'user')
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

  console.log(`\nListings -> insertados: ${inserted} | ya existian: ${skipped} | vendedores: ${sellers.length}`);

  // 5) Datos de demo del comprador: medios de pago (TP4 TDE) + trades en varios
  //    estados del escrow. Mismo key simetrico que la API (db.js).
  const PAYMENT_KEY = process.env.PAYMENT_KEY || 'tde_demo_key_change_me';

  // 5a) Tarjetas cifradas en reposo. Idempotente por (user, last4).
  const cards = [
    { username: 'ana_buyer',   number: '4539115678901234' },
    { username: 'ana_buyer',   number: '5500005555558888' },
    { username: 'carla_sells', number: '4000123412341234' },
  ];
  let cardsAdded = 0;
  for (const c of cards) {
    const r = await client.query(
      `INSERT INTO payment_methods (user_id, card_encrypted, card_last4)
       SELECT u.id, pgp_sym_encrypt($2, $3), right($2, 4)
       FROM users u
       WHERE u.username = $1
         AND NOT EXISTS (
           SELECT 1 FROM payment_methods pm
           WHERE pm.user_id = u.id AND pm.card_last4 = right($2, 4)
         )`,
      [c.username, c.number, PAYMENT_KEY]
    );
    cardsAdded += r.rowCount;
  }

  // 5b) Trades de ana_buyer en distintos estados (ademas del #1 disputado de 04_seed).
  //     Referencia por titulo (deterministico). Idempotente: salta si ana ya
  //     tiene una tx sobre ese listing.
  const trades = [
    { title: 'Cuenta Valorant Inmortal 3 — 40 skins', status: 'escrow_held',      listingStatus: 'in_escrow' },
    { title: 'AWP Dragon Lore (Field-Tested)',        status: 'item_transferred', listingStatus: 'in_escrow' },
    { title: 'Key Elden Ring Deluxe (Steam Global)',  status: 'released',         listingStatus: 'sold' },
  ];
  let tradesAdded = 0;
  for (const t of trades) {
    const ins = await client.query(
      `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status)
       SELECT l.id, b.id, l.seller_id, l.price, $2::tx_status
       FROM listings l
       CROSS JOIN (SELECT id FROM users WHERE username = 'ana_buyer') b
       WHERE l.title = $1
         AND NOT EXISTS (
           SELECT 1 FROM transactions x WHERE x.listing_id = l.id AND x.buyer_id = b.id
         )
       RETURNING id, listing_id`,
      [t.title, t.status]
    );
    if (ins.rowCount > 0) {
      tradesAdded++;
      await client.query(
        `UPDATE listings SET status = $2::listing_status, updated_at = now() WHERE id = $1`,
        [ins.rows[0].listing_id, t.listingStatus]
      );
      // item ya entregado -> rastro auditable (TP7)
      if (t.status === 'item_transferred' || t.status === 'released') {
        await client.query(
          `INSERT INTO item_transfers (transaction_id, transferred_by, note)
           SELECT tx.id, l.seller_id, 'Entrega seed demo'
           FROM transactions tx JOIN listings l ON l.id = tx.listing_id
           WHERE tx.id = $1`,
          [ins.rows[0].id]
        );
      }
    }
  }

  console.log(`Demo comprador -> tarjetas nuevas: ${cardsAdded} | trades nuevos: ${tradesAdded}`);
  await client.end();
}

main().catch(async (e) => {
  console.error('Seed FALLO:', e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
