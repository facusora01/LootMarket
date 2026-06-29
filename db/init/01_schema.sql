-- Schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE listing_category AS ENUM ('account', 'skin', 'item', 'key');
CREATE TYPE listing_status AS ENUM ('active', 'in_escrow', 'sold', 'removed');
CREATE TYPE tx_status AS ENUM ('escrow_held', 'item_transferred', 'released', 'refunded', 'disputed');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved_buyer', 'resolved_seller');

-- Usuarios
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones
CREATE TABLE sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Listings
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

-- Transacciones (escrow)
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

-- Transferencias de item
CREATE TABLE item_transfers (
    id             SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES transactions(id),
    transferred_by INT NOT NULL REFERENCES users(id),
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note           TEXT NOT NULL DEFAULT ''
);

-- Medios de pago (cifrados en reposo)
CREATE TABLE payment_methods (
    id             SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_encrypted BYTEA NOT NULL,
    card_last4     CHAR(4) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disputas
CREATE TABLE disputes (
    id             SERIAL PRIMARY KEY,
    transaction_id INT UNIQUE NOT NULL REFERENCES transactions(id),
    opened_by      INT NOT NULL REFERENCES users(id),
    reason         TEXT NOT NULL,
    private_account_data TEXT NOT NULL DEFAULT '',
    status         dispute_status NOT NULL DEFAULT 'open',
    moderator_id   INT REFERENCES users(id),
    resolution     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);

-- Grants JIT (TP8)
CREATE TABLE jit_grants (
    id           SERIAL PRIMARY KEY,
    moderator_id INT NOT NULL REFERENCES users(id),
    dispute_id   INT NOT NULL REFERENCES disputes(id),
    reason       TEXT NOT NULL,
    granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN NOT NULL DEFAULT false
);

-- Log de auditoria (append-only, TP7)
CREATE TABLE audit_log (
    id         BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation  TEXT NOT NULL,
    row_id     INT,
    actor_id   TEXT,
    before_img JSONB,
    after_img  JSONB,
    at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notificaciones
CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    message    TEXT NOT NULL,
    link       TEXT,
    read       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_notif_user_unread ON notifications(user_id, read);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_tx_buyer ON transactions(buyer_id);
CREATE INDEX idx_tx_seller ON transactions(seller_id);
CREATE INDEX idx_audit_table_row ON audit_log(table_name, row_id);
CREATE INDEX idx_jit_active ON jit_grants(moderator_id, dispute_id) WHERE NOT revoked;
