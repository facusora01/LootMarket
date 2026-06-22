-- TP4 (DDM) + TP3 (ABAC/RLS) + TP8 (JIT) + TP6 (minimo privilegio)

------------------------------------------------------------------
-- TP4: DDM — el comprador nunca ve el email real del vendedor.
-- Vanilla Postgres no trae DDM nativo (la extension "anon" lo hace con
-- SECURITY LABEL); aca lo implementamos con funcion de mascara + vista,
-- mismo principio: el dato real queda intacto en disco, se ofusca al vuelo.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mask_email(email TEXT) RETURNS TEXT AS $$
    SELECT left(split_part(email, '@', 1), 2) || '****@' || split_part(email, '@', 2);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE VIEW v_listings_public AS
SELECT l.id, l.title, l.category, l.description, l.price, l.status,
       l.created_at, l.updated_at,
       u.username AS seller_username,
       mask_email(u.email) AS seller_email_masked,
       l.image_url
FROM listings l
JOIN users u ON u.id = l.seller_id;

------------------------------------------------------------------
-- TP6: la API se conecta con un rol de minimo privilegio, nunca superuser,
-- sin ownership de tablas y sin permisos de DROP (CIS: PoLP).
------------------------------------------------------------------
CREATE ROLE lootmarket_app LOGIN PASSWORD 'app_secret_change_me';
GRANT CONNECT ON DATABASE lootmarket TO lootmarket_app;
GRANT USAGE ON SCHEMA public TO lootmarket_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lootmarket_app;
GRANT DELETE ON sessions TO lootmarket_app;       -- logout
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lootmarket_app;
-- audit_log: solo insertar (via trigger) y leer; update/delete bloqueados por trigger
REVOKE UPDATE, DELETE ON audit_log FROM lootmarket_app;

------------------------------------------------------------------
-- TP3 + TP8: ABAC con Row Level Security sobre disputas.
-- Atributos evaluados en tiempo de ejecucion:
--   sujeto:  app.user_id, app.role (seteados por la API por request)
--   recurso: la disputa y sus participantes
--   entorno: now() vs expires_at del grant JIT
-- Un moderador NO ve los datos privados de una disputa por tener el rol
-- (eso seria RBAC puro): necesita un grant JIT activo y no expirado.
------------------------------------------------------------------
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes FORCE ROW LEVEL SECURITY;

-- Helpers: en conexiones de pool el GUC puede quedar como '' (no NULL) despues
-- del commit; NULLIF evita el error de cast ''::int en las policies.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS int AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::int
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_role() RETURNS text AS $$
    SELECT NULLIF(current_setting('app.role', true), '')
$$ LANGUAGE sql STABLE;

-- Participantes de la transaccion ven su propia disputa
CREATE POLICY p_disputes_participants ON disputes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = disputes.transaction_id
              AND app_user_id() IN (t.buyer_id, t.seller_id)
        )
    );

-- Moderador: solo con grant JIT vigente sobre ESA disputa (TP8: JIT + TP3: ABAC)
CREATE POLICY p_disputes_moderator_jit ON disputes
    FOR SELECT
    USING (
        app_role() = 'moderator'
        AND EXISTS (
            SELECT 1 FROM jit_grants g
            WHERE g.dispute_id = disputes.id
              AND g.moderator_id = app_user_id()
              AND NOT g.revoked
              AND g.expires_at > now()      -- atributo de entorno: expiracion automatica
        )
    );

-- Admin de plataforma ve todo (supervision)
CREATE POLICY p_disputes_admin ON disputes
    FOR SELECT
    USING (app_role() = 'admin');

-- Escrituras: la API valida la logica de negocio; participantes abren,
-- moderador con JIT vigente resuelve.
CREATE POLICY p_disputes_insert ON disputes
    FOR INSERT
    WITH CHECK (app_user_id() IS NOT NULL);

CREATE POLICY p_disputes_update_mod ON disputes
    FOR UPDATE
    USING (
        app_role() = 'admin'
        OR (
            app_role() = 'moderator'
            AND EXISTS (
                SELECT 1 FROM jit_grants g
                WHERE g.dispute_id = disputes.id
                  AND g.moderator_id = app_user_id()
                  AND NOT g.revoked
                  AND g.expires_at > now()
            )
        )
    );

------------------------------------------------------------------
-- Vista resumen para moderadores: metadatos de disputas SIN datos privados.
-- Corre con privilegios del owner (postgres, BYPASSRLS), por eso expone
-- solo columnas no sensibles. El detalle completo sigue detras de RLS+JIT.
------------------------------------------------------------------
CREATE VIEW disputes_summary AS
SELECT id, transaction_id, status, created_at, resolved_at
FROM disputes;

GRANT SELECT ON disputes_summary TO lootmarket_app;

------------------------------------------------------------------
-- RLS sobre payment_methods: cada usuario solo ve sus propios medios de pago
------------------------------------------------------------------
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;

CREATE POLICY p_payment_owner ON payment_methods
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

------------------------------------------------------------------
-- RLS sobre transactions: usuarios solo ven e interactúan con sus propias transacciones (TP3)
------------------------------------------------------------------
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_transactions_select ON transactions
    FOR SELECT
    USING (buyer_id = app_user_id() OR seller_id = app_user_id() OR app_role() = 'admin' OR app_role() = 'moderator');

CREATE POLICY p_transactions_insert ON transactions
    FOR INSERT
    WITH CHECK (buyer_id = app_user_id() OR app_role() = 'admin');

CREATE POLICY p_transactions_update ON transactions
    FOR UPDATE
    USING (buyer_id = app_user_id() OR seller_id = app_user_id() OR app_role() = 'admin' OR app_role() = 'moderator');

------------------------------------------------------------------
-- RLS sobre listings: vendedores solo modifican sus propios listings (TP3)
------------------------------------------------------------------
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;

CREATE POLICY p_listings_select ON listings
    FOR SELECT
    USING (status = 'active' OR seller_id = app_user_id() OR app_role() = 'admin' OR app_role() = 'moderator');

CREATE POLICY p_listings_insert ON listings
    FOR INSERT
    WITH CHECK (seller_id = app_user_id() OR app_role() = 'admin');

CREATE POLICY p_listings_update ON listings
    FOR UPDATE
    USING (
        seller_id = app_user_id() 
        OR app_role() = 'admin'
        OR (
            app_role() = 'buyer' 
            AND (
                (status = 'active' AND seller_id <> app_user_id()) -- compra
                OR (status = 'in_escrow') -- confirmacion/release
            )
        )
    );

CREATE POLICY p_listings_delete ON listings
    FOR DELETE
    USING (seller_id = app_user_id() OR app_role() = 'admin');
