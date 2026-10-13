-- Backup Inspection (SDS-BR-001 section 7.2, phase 1): a backup is restored into a read-only scratch database named inspect_{id}
-- for a short, fixed time (5 minutes), checked with database queries, and dropped by the agent when the time is up. The request
-- needs an approval by a different person with an electronic signature. Production is not touched.
CREATE SEQUENCE backup_inspection_seq;
CREATE TABLE backup_inspection (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id          VARCHAR(30)  NOT NULL UNIQUE,
    run_id                 UUID         NOT NULL REFERENCES backup_run (id),
    status                 VARCHAR(20)  NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'REJECTED', 'APPROVED', 'OPENING', 'OPEN', 'CLOSED', 'FAILED')),
    reason                 TEXT         NOT NULL,
    requested_by           VARCHAR(120) NOT NULL,
    requested_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    approved_by            VARCHAR(120),
    approval_signature_ref VARCHAR(120),
    decided_at             TIMESTAMPTZ,
    decision_reason        TEXT,
    scratch_db             VARCHAR(63),
    opened_at              TIMESTAMPTZ,
    expires_at             TIMESTAMPTZ,
    closed_at              TIMESTAMPTZ,
    closed_by              VARCHAR(120),
    close_reason           VARCHAR(40),
    error_code             VARCHAR(60),
    error_detail           TEXT,
    -- the person who asked may not approve; the database refuses it even if the service does not
    CONSTRAINT backup_inspection_two_people CHECK (approved_by IS NULL OR lower(approved_by) <> lower(requested_by))
);
CREATE INDEX backup_inspection_run_idx ON backup_inspection (run_id);
-- one inspection at a time on the whole agent: the scratch database and its read-only role are a shared, short-lived resource
CREATE UNIQUE INDEX backup_inspection_one_open ON backup_inspection ((true))
    WHERE status IN ('PENDING_APPROVAL', 'APPROVED', 'OPENING', 'OPEN');

CREATE TABLE backup_inspection_event (
    id            BIGSERIAL PRIMARY KEY,
    inspection_id UUID         NOT NULL REFERENCES backup_inspection (id),
    event         VARCHAR(40)  NOT NULL,
    by_user       VARCHAR(120) NOT NULL,
    at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail_json   JSONB
);
CREATE TRIGGER backup_inspection_event_append_only BEFORE UPDATE OR DELETE ON backup_inspection_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE backup_inspection_check (
    id            BIGSERIAL PRIMARY KEY,
    inspection_id UUID         NOT NULL REFERENCES backup_inspection (id),
    code          VARCHAR(40)  NOT NULL,
    title         VARCHAR(120) NOT NULL,
    required      BOOLEAN      NOT NULL,
    ok            BOOLEAN      NOT NULL,
    detail        TEXT,
    checked_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX backup_inspection_check_idx ON backup_inspection_check (inspection_id);
CREATE TRIGGER backup_inspection_check_append_only BEFORE UPDATE OR DELETE ON backup_inspection_check
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN ('BACKUP_DB', 'VERIFY', 'EXPORT', 'REHEARSAL', 'INSPECTION'));
