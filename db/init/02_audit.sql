-- Auditoria (TP7)

-- Trigger generico: captura actor, operacion y before/after image
CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger AS $$
DECLARE
    v_actor TEXT := current_setting('app.user_id', true);
    v_row_id INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_row_id := OLD.id;
        INSERT INTO audit_log(table_name, operation, row_id, actor_id, before_img, after_img)
        VALUES (TG_TABLE_NAME, TG_OP, v_row_id, v_actor, to_jsonb(OLD), NULL);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_row_id := NEW.id;
        INSERT INTO audit_log(table_name, operation, row_id, actor_id, before_img, after_img)
        VALUES (TG_TABLE_NAME, TG_OP, v_row_id, v_actor, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSE
        v_row_id := NEW.id;
        INSERT INTO audit_log(table_name, operation, row_id, actor_id, before_img, after_img)
        VALUES (TG_TABLE_NAME, TG_OP, v_row_id, v_actor, NULL, to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers sobre tablas criticas
CREATE TRIGGER trg_audit_listings
    AFTER INSERT OR UPDATE OR DELETE ON listings
    FOR EACH ROW EXECUTE FUNCTION fn_audit();

CREATE TRIGGER trg_audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_audit();

CREATE TRIGGER trg_audit_item_transfers
    AFTER INSERT OR UPDATE OR DELETE ON item_transfers
    FOR EACH ROW EXECUTE FUNCTION fn_audit();

CREATE TRIGGER trg_audit_disputes
    AFTER INSERT OR UPDATE OR DELETE ON disputes
    FOR EACH ROW EXECUTE FUNCTION fn_audit();

CREATE TRIGGER trg_audit_jit_grants
    AFTER INSERT OR UPDATE OR DELETE ON jit_grants
    FOR EACH ROW EXECUTE FUNCTION fn_audit();

-- Append-only: bloquea UPDATE/DELETE sobre audit_log
CREATE OR REPLACE FUNCTION fn_audit_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log es append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();
