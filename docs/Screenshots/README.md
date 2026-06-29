# Screenshots — LootMarket (para presentación)

Capturas de las pantallas principales, 1440×900, generadas con la app corriendo
(`start.ps1`) y los usuarios demo (`password123`).

| # | Archivo | Pantalla | Usuario | Qué muestra |
|---|---------|----------|---------|-------------|
| 01 | `01-login.png` | Login / landing | — | Pitch, escrow, branding |
| 02 | `02-mercado.png` | Mercado | ana_buyer | Catálogo, stats, flujo de escrow, filtros |
| 03 | `03-listing-detail.png` | Detalle de listing | ana_buyer | Item, escrow, **email enmascarado** (TP4 DDM) |
| 04 | `04-mis-trades.png` | Mis trades | ana_buyer | 4 trades en estados: completada / item transferido / en escrow / en disputa |
| 05 | `05-pagos.png` | Pagos | ana_buyer | 2 tarjetas enmascaradas, cifradas con pgp_sym_encrypt (TP4 TDE) |
| 06 | `06-vender.png` | Vender | carla_sells | Publicar listing + preview |
| 07 | `07-disputas.png` | Disputas | mod_mati | Caso abierto, **"Sin acceso JIT"** (TP8) |
| 08 | `08-auditoria.png` | Auditoría | admin_root | Log forense append-only (TP7) |
| 09 | `09-auditoria-rastreo.png` | Rastreo forense | admin_root | **Demo estrella**: transacción #1 con before/after image |

## Generación

App levantada con `start.ps1`; capturas con Playwright (headless, 1440×900),
login por formulario con los usuarios demo. Para regenerar: ver
`scratchpad/shoot.mjs` (corrida original).

## Cambios aplicados para poblar la demo

Dos pantallas salían vacías por falta de datos / un bug de RLS. Se corrigió:

1. **Bug RLS (TP3) — comprador no veía sus propios trades.**
   `GET /api/transactions/mine` hace `INNER JOIN listings`, y `p_listings_select`
   solo dejaba ver listings `active`, propios o admin/mod. Al pasar el listing a
   `in_escrow`/`sold`, la compradora dejaba de verlo y el JOIN descartaba su propia
   compra. Fix en [`03_security.sql`](../../db/init/03_security.sql): se agregó a la
   policy
   `OR EXISTS (SELECT 1 FROM transactions t WHERE t.listing_id = listings.id AND t.buyer_id = app_user_id())`.
   Coherente con ABAC: el comprador es atributo-sujeto válido del recurso.

2. **Seed de demo del comprador** en [`server/seed.mjs`](../../server/seed.mjs)
   (idempotente): 2 tarjetas cifradas (`pgp_sym_encrypt`) para ana_buyer + 1 para
   carla, y 3 trades de ana_buyer en estados `escrow_held` / `item_transferred` /
   `released` (sumados al `disputed` que ya traía `04_seed.sql`).

Reproducir: `docker compose up -d` → `.\seed.ps1` (corre `server/seed.mjs`).
