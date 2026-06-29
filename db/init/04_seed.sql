-- Datos de ejemplo (password "password123" para todos)

SELECT set_config('app.user_id', 'seed', false);

-- Usuarios
INSERT INTO users (username, email, password_hash, role) VALUES
('ana_buyer',   'ana@gmail.com',     crypt('password123', gen_salt('bf', 10)), 'user'),
('bruno_buyer', 'bruno@hotmail.com', crypt('password123', gen_salt('bf', 10)), 'user'),
('carla_sells', 'carla@gmail.com',   crypt('password123', gen_salt('bf', 10)), 'user'),
('dario_sells', 'dario@yahoo.com',   crypt('password123', gen_salt('bf', 10)), 'user'),
('mod_mati',    'mati@lootmarket.io',  crypt('password123', gen_salt('bf', 10)), 'moderator'),
('admin_root',  'admin@lootmarket.io', crypt('password123', gen_salt('bf', 10)), 'admin');

-- Listings
INSERT INTO listings (seller_id, title, category, description, price, status) VALUES
(3, 'Cuenta Valorant Inmortal 3 — 40 skins', 'account', 'Cuenta full acceso, email original incluido.', 150.00, 'active'),
(3, 'AWP Dragon Lore (Field-Tested)',        'skin',    'CS2, float 0.18, tradeable ya.',              1200.00, 'active'),
(4, 'Key Elden Ring Deluxe (Steam Global)',  'key',     'Entrega instantanea de clave.',                 35.50, 'active'),
(4, 'Set armadura Tarisland +500 gemas',     'item',    'Entrega in-game, server SA.',                   22.00, 'active'),
(3, 'Cuenta Fortnite OG — Renegade Raider',  'account', 'Skin rara temporada 1.',                       800.00, 'active');

-- Transaccion disputada (para probar moderacion)
INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status)
VALUES (5, 1, 3, 800.00, 'disputed');

UPDATE listings SET status = 'in_escrow' WHERE id = 5;

-- Caso forense: la vendedora cambia el precio despues de la venta (queda en audit_log)
SELECT set_config('app.user_id', '3', false);
UPDATE listings SET price = 850.00, updated_at = now() WHERE id = 5;
UPDATE listings SET price = 950.00, updated_at = now() WHERE id = 5;
SELECT set_config('app.user_id', 'seed', false);

-- Disputa con datos privados (solo visibles con JIT)
INSERT INTO disputes (transaction_id, opened_by, reason, private_account_data)
VALUES (1, 1,
        'El vendedor nunca transfirio la cuenta. Pago hace 5 dias.',
        'login: renegade_og@mail.com / recovery: +54911****22 / 2FA backup codes adjuntos');
