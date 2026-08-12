-- GMP data-integrity hardening (Annex 11 §9 / ALCOA+): the application connects to
-- Postgres as a single shared role ('eqms', used by both the running app and Flyway
-- itself), so REVOKE-based lockdown is not viable long-term — a future migration
-- running as the same role would be unable to fix these tables. Instead, block
-- mutation with a trigger, which is enforced regardless of which role/session issues
-- the statement.
--
-- The only legitimate exception in the codebase is DocumentService.permanentlyDeleteDocument(),
-- which purges a hard-deleted document's own audit history. That call now wraps itself
-- in `SET LOCAL app.allow_audit_purge = 'true'` (transaction-scoped, auto-resets on
-- commit/rollback) so the trigger can allow it while blocking everything else.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
    IF current_setting('app.allow_audit_purge', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Audit trail records are immutable and cannot be %. (table: %)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable_row ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable_row
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_changes_immutable ON audit_log_changes;
CREATE TRIGGER trg_audit_log_changes_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log_changes
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_changes_immutable_row ON audit_log_changes;
CREATE TRIGGER trg_audit_log_changes_immutable_row
    BEFORE UPDATE OR DELETE ON audit_log_changes
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
