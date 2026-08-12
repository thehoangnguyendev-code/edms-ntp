-- Audit records are GMP evidence. A business document may be permanently purged only from the
-- operational tables; its audit history remains immutable and retrievable for the retention term.
-- V245 already blocks DELETE/UPDATE/TRUNCATE. Remove its obsolete application-purge exception so
-- the guarantee is also explicit at database level.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail records are immutable and cannot be %. (table: %)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
