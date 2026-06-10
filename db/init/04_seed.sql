-- Datos de ejemplo. Passwords hasheadas con pgcrypto: crypt + blowfish costo 10 (TP4).
-- Todos los usuarios seed tienen password "password123".

SELECT set_config('app.user_id', 'seed', false);

INSERT INTO users (username, email, password_hash, role) VALUES
('ana_buyer',   'ana@gmail.com',     crypt('password123', gen_salt('bf', 10)), 'buyer'),
('bruno_buyer', 'bruno@hotmail.com', crypt('password123', gen_salt('bf', 10)), 'buyer'),
('carla_sells', 'carla@gmail.com',   crypt('password123', gen_salt('bf', 10)), 'seller'),
('dario_sells', 'dario@yahoo.com',   crypt('password123', gen_salt('bf', 10)), 'seller'),
('mod_mati',    'mati@lootmarket.io',  crypt('password123', gen_salt('bf', 10)), 'moderator'),
('admin_root',  'admin@lootmarket.io', crypt('password123', gen_salt('bf', 10)), 'admin');

INSERT INTO listings (seller_id, title, category, description, price, status) VALUES
(3, 'Cuenta Valorant Inmortal 3 — 40 skins', 'account', 'Cuenta full acceso, email original incluido.', 150.00, 'active'),
(3, 'AWP Dragon Lore (Field-Tested)',        'skin',    'CS2, float 0.18, tradeable ya.',              1200.00, 'active'),
(4, 'Key Elden Ring Deluxe (Steam Global)',  'key',     'Entrega instantanea de clave.',                 35.50, 'active'),
(4, 'Set armadura Tarisland +500 gemas',     'item',    'Entrega in-game, server SA.',                   22.00, 'active'),
(3, 'Cuenta Fortnite OG — Renegade Raider',  'account', 'Skin rara temporada 1.',                       800.00, 'active');

-- Transaccion de ejemplo ya disputada para probar flujo de moderacion:
INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status)
VALUES (5, 1, 3, 800.00, 'disputed');

UPDATE listings SET status = 'in_escrow' WHERE id = 5;

INSERT INTO disputes (transaction_id, opened_by, reason, private_account_data)
VALUES (1, 1,
        'El vendedor nunca transfirio la cuenta. Pago hace 5 dias.',
        'login: renegade_og@mail.com / recovery: +54911****22 / 2FA backup codes adjuntos');
