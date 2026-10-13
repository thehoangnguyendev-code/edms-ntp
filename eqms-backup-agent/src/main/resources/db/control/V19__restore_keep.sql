-- Restore that keeps its database (SDS 11.3, R6-R7 for a real restore). Unlike a rehearsal, which drops its scratch database, a keep
-- restore leaves a verified copy of a backup in its own database so that the database can be swapped in during a maintenance window.
-- The record is append-only: the copy is recorded when it is made and when it is dropped or swapped.
ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN ('BACKUP_DB', 'VERIFY', 'EXPORT', 'REHEARSAL', 'INSPECTION', 'RESTORE_KEEP'));

CREATE TABLE restore_keep (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keep_code    VARCHAR(40)  NOT NULL UNIQUE,
    backup_id    VARCHAR(40)  NOT NULL,
    db_name      VARCHAR(63)  NOT NULL UNIQUE,
    status       VARCHAR(20)  NOT NULL CHECK (status IN ('READY', 'FAILED')),
    requested_by VARCHAR(120) NOT NULL,
    made_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    error_code   VARCHAR(60),
    error_detail TEXT,
    checks_json  JSONB
);
CREATE TRIGGER restore_keep_append_only BEFORE UPDATE OR DELETE ON restore_keep
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
