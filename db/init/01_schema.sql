-- LootMarket schema
-- TP4: pgcrypto para hashing de contraseñas y cifrado de datos de pago
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'moderator', 'admin');
CREATE TYPE listing_category AS ENUM ('account', 'skin', 'item', 'key');
CREATE TYPE listing_status AS ENUM ('active', 'in_escrow', 'sold', 'removed');
CREATE TYPE tx_status AS ENUM ('escrow_held', 'item_transferred', 'released', 'refunded', 'disputed');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved_buyer', 'resolved_seller');

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    -- TP4: nunca texto plano; crypt() + gen_salt('bf') via pgcrypto
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'buyer',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TP4: tokens de sesion guardados hasheados (sha256), nunca el token en claro
CREATE TABLE sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
    id          SERIAL PRIMARY KEY,
    seller_id   INT NOT NULL REFERENCES users(id),
    title       VARCHAR(120) NOT NULL,
    category    listing_category NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
    image_url   TEXT,
    status      listing_status NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Escrow: el dinero queda retenido hasta confirmacion del comprador o resolucion de disputa
CREATE TABLE transactions (
    id         SERIAL PRIMARY KEY,
    listing_id INT NOT NULL REFERENCES listings(id),
    buyer_id   INT NOT NULL REFERENCES users(id),
    seller_id  INT NOT NULL REFERENCES users(id),
    amount     NUMERIC(12,2) NOT NULL,
    status     tx_status NOT NULL DEFAULT 'escrow_held',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TP7: cada transferencia de item es un hecho auditable independiente
CREATE TABLE item_transfers (
    id             SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES transactions(id),
    transferred_by INT NOT NULL REFERENCES users(id),
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note           TEXT NOT NULL DEFAULT ''
);

-- TP4: datos de pago cifrados en reposo (pgp_sym_encrypt ~ TDE a nivel columna,
-- vanilla Postgres no trae TDE nativo / pg_tde)
CREATE TABLE payment_methods (
    id             SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_encrypted BYTEA NOT NULL,
    card_last4     CHAR(4) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
    id             SERIAL PRIMARY KEY,
    transaction_id INT UNIQUE NOT NULL REFERENCES transactions(id),
    opened_by      INT NOT NULL REFERENCES users(id),
    reason         TEXT NOT NULL,
    -- datos privados de la cuenta en disputa: solo visibles con grant JIT activo (TP8)
    private_account_data TEXT NOT NULL DEFAULT '',
    status         dispute_status NOT NULL DEFAULT 'open',
    moderator_id   INT REFERENCES users(id),
    resolution     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);

-- TP8: privilegios Just-In-Time para moderadores. Acceso temporal, acotado a una
-- disputa, con expiracion automatica y motivo declarado.
CREATE TABLE jit_grants (
    id           SERIAL PRIMARY KEY,
    moderator_id INT NOT NULL REFERENCES users(id),
    dispute_id   INT NOT NULL REFERENCES disputes(id),
    reason       TEXT NOT NULL,
    granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN NOT NULL DEFAULT false
);

-- TP7: log forense append-only con before/after image de cada operacion
CREATE TABLE audit_log (
    id         BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation  TEXT NOT NULL,            -- INSERT / UPDATE / DELETE
    row_id     INT,
    actor_id   TEXT,                     -- app.user_id seteado por la API por request
    before_img JSONB,                    -- imagen previa (clave para forensia, cf. TP7)
    after_img  JSONB,
    at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_status ON listings(status);
-- LM-58: composite indexes for listing filtering + sorting
CREATE INDEX idx_listings_cat_created ON listings(status, category, created_at DESC);
CREATE INDEX idx_listings_cat_price   ON listings(status, category, price);

-- LM-58: extend transaction indexes with sort order
CREATE INDEX idx_tx_buyer_created ON transactions(buyer_id, created_at DESC);
CREATE INDEX idx_tx_seller_created ON transactions(seller_id, created_at DESC);

-- LM-58: partial index for open disputes (most frequent dispute query)
CREATE INDEX idx_disputes_open ON disputes(status) WHERE status = 'open';

-- LM-58: audit log ordering for forensic traces
CREATE INDEX idx_audit_table_row_at ON audit_log(table_name, row_id, at, id);

CREATE INDEX idx_jit_active ON jit_grants(moderator_id, dispute_id) WHERE NOT revoked;
