-- DC-XF-65: electronic_signatures had no DB-level protection against UPDATE/DELETE/TRUNCATE -- a
-- direct repository call or a DBA with SQL access could alter or erase a signature record without
-- the audit trail reflecting it. Confirmed via code review (grep for ElectronicSignatureRepository
-- .save(...) call sites) that the application only ever INSERTs a brand-new ElectronicSignature row
-- (createRevisionSignature / createEntitySignature) -- it never re-fetches and updates an existing
-- one, so locking UPDATE/DELETE/TRUNCATE here has no legitimate application code to break. Mirrors
-- the exact pattern already applied to audit_logs/audit_log_changes in
-- V245__lock_audit_logs_immutability.sql, including the same session-scoped escape hatch for a
-- deliberate, controlled purge (SET LOCAL app.allow_audit_purge = 'true') -- signatures share the
-- same regulated-record lifecycle as audit trail entries and should be purgeable only through the
-- same controlled mechanism, never a silent mutation.
CREATE OR REPLACE FUNCTION prevent_electronic_signature_mutation()
RETURNS trigger AS $$
BEGIN
    IF current_setting('app.allow_audit_purge', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Electronic signature records are immutable and cannot be %. (table: %)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_electronic_signatures_immutable ON electronic_signatures;
CREATE TRIGGER trg_electronic_signatures_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON electronic_signatures
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_electronic_signature_mutation();

DROP TRIGGER IF EXISTS trg_electronic_signatures_immutable_row ON electronic_signatures;
CREATE TRIGGER trg_electronic_signatures_immutable_row
    BEFORE UPDATE OR DELETE ON electronic_signatures
    FOR EACH ROW EXECUTE FUNCTION prevent_electronic_signature_mutation();
