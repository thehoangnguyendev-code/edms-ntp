-- Restore rehearsal (SDS-BR-001 section 14.1, tier V2/V3): a backup is decrypted and restored into a scratch database, the
-- post-restore checks of section 14.3 run against it, and the scratch database is dropped. The result is evidence that the
-- backup can actually be restored; it is never replaced, only added to. Production is not touched.
CREATE SEQUENCE restore_rehearsal_seq;
CREATE TABLE restore_rehearsal (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rehearsal_id  VARCHAR(30)  NOT NULL UNIQUE,
    run_id        UUID         NOT NULL REFERENCES backup_run (id),
    status        VARCHAR(20)  NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'PASSED', 'FAILED')),
    requested_by  VARCHAR(120) NOT NULL,
    reason        TEXT         NOT NULL,
    requested_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    scratch_db    VARCHAR(63),
    restore_seconds INTEGER,
    error_code    VARCHAR(60),
    error_detail  TEXT
);
CREATE UNIQUE INDEX restore_rehearsal_one_open ON restore_rehearsal ((true)) WHERE status IN ('QUEUED', 'RUNNING');
CREATE INDEX restore_rehearsal_run_idx ON restore_rehearsal (run_id);

CREATE TABLE restore_rehearsal_check (
    id            BIGSERIAL PRIMARY KEY,
    rehearsal_id  UUID         NOT NULL REFERENCES restore_rehearsal (id),
    code          VARCHAR(40)  NOT NULL,
    title         VARCHAR(120) NOT NULL,
    required      BOOLEAN      NOT NULL,
    ok            BOOLEAN      NOT NULL,
    detail        TEXT,
    checked_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX restore_rehearsal_check_idx ON restore_rehearsal_check (rehearsal_id);
CREATE TRIGGER restore_rehearsal_check_append_only BEFORE UPDATE OR DELETE ON restore_rehearsal_check
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN ('BACKUP_DB', 'VERIFY', 'EXPORT', 'REHEARSAL'));
