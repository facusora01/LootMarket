-- Seguridad: DDM (TP4) + RLS/ABAC (TP3) + JIT (TP8) + minimo privilegio (TP6)

-- DDM: enmascarado de email + vista publica
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

-- Rol de minimo privilegio para la API (TP6). El rol y su password se crean en
-- 00_roles.sh desde $APP_DB_PASSWORD (A.5.17: secreto fuera del codigo). Aca solo
-- se otorgan privilegios.
GRANT CONNECT ON DATABASE lootmarket TO lootmarket_app;
GRANT USAGE ON SCHEMA public TO lootmarket_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO lootmarket_app;
GRANT DELETE ON sessions TO lootmarket_app;
GRANT DELETE ON listings TO lootmarket_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lootmarket_app;
REVOKE UPDATE, DELETE ON audit_log FROM lootmarket_app;

-- RLS sobre disputes (ABAC + JIT)
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes FORCE ROW LEVEL SECURITY;

-- Helpers de contexto (NULLIF: GUC de pool vuelve '' no NULL)
CREATE OR REPLACE FUNCTION app_user_id() RETURNS int AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::int
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_role() RETURNS text AS $$
    SELECT NULLIF(current_setting('app.role', true), '')
$$ LANGUAGE sql STABLE;

CREATE POLICY p_disputes_participants ON disputes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = disputes.transaction_id
              AND app_user_id() IN (t.buyer_id, t.seller_id)
        )
    );

CREATE POLICY p_disputes_moderator_jit ON disputes
    FOR SELECT
    USING (
        app_role() = 'moderator'
        AND EXISTS (
            SELECT 1 FROM jit_grants g
            WHERE g.dispute_id = disputes.id
              AND g.moderator_id = app_user_id()
              AND NOT g.revoked
              AND g.expires_at > now()
        )
    );

CREATE POLICY p_disputes_admin ON disputes
    FOR SELECT
    USING (app_role() = 'admin');

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

-- Vista resumen para moderadores (solo metadatos)
CREATE VIEW disputes_summary AS
SELECT id, transaction_id, status, created_at, resolved_at
FROM disputes;

GRANT SELECT ON disputes_summary TO lootmarket_app;

-- RLS sobre payment_methods (dueno)
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;

CREATE POLICY p_payment_owner ON payment_methods
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

-- RLS sobre transactions (participantes)
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

-- RLS sobre listings (dueno modifica; comprador transiciona escrow)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;

CREATE POLICY p_listings_select ON listings
    FOR SELECT
    USING (
        status = 'active'
        OR seller_id = app_user_id()
        OR app_role() = 'admin'
        OR app_role() = 'moderator'
        -- el comprador ve el listing de su propia transaccion aunque no este 'active'
        OR EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.listing_id = listings.id AND t.buyer_id = app_user_id()
        )
    );

CREATE POLICY p_listings_insert ON listings
    FOR INSERT
    WITH CHECK (seller_id = app_user_id() OR app_role() = 'admin');

CREATE POLICY p_listings_update ON listings
    FOR UPDATE
    USING (
        seller_id = app_user_id()
        OR app_role() = 'admin'
        OR (
            app_role() = 'user'
            AND (
                (status = 'active' AND seller_id <> app_user_id())
                OR (status = 'in_escrow')                          
                OR (status = 'sold')                               
            )
        )
    );

CREATE POLICY p_listings_delete ON listings
    FOR DELETE
    USING (seller_id = app_user_id() OR app_role() = 'admin');

-- RLS sobre notifications (SELECT/UPDATE propias; INSERT abierto: server notifica a la contraparte)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY p_notif_select ON notifications
    FOR SELECT
    USING (user_id = app_user_id() OR app_role() = 'admin');

CREATE POLICY p_notif_insert ON notifications
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY p_notif_update ON notifications
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());
