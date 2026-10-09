-- Export Backup Set and the Offline Media Register (SDS-BR-001 sections 6.5 and 17). A package is only ever written to a registered
-- medium, by an agent job, after a second person approved it. Events are append-only: the register is evidence.
CREATE TABLE offline_media (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label              VARCHAR(60)  NOT NULL UNIQUE,
    serial_number      VARCHAR(120) NOT NULL,
    kind               VARCHAR(20)  NOT NULL CHECK (kind IN ('HDD', 'SSD', 'USB', 'TAPE')),
    capacity_bytes     BIGINT       NOT NULL CHECK (capacity_bytes > 0),
    -- one folder name under the agent's export root; the only place the agent writes for this medium
    export_dir         VARCHAR(64)  NOT NULL UNIQUE CHECK (export_dir ~ '^[A-Za-z0-9._-]{1,64}$' AND export_dir NOT IN ('.', '..')),
    status             VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE'
                       CHECK (status IN ('AVAILABLE', 'IN_TRANSIT', 'STORED_OFFSITE', 'IN_READ_TEST', 'QUARANTINED', 'RETIRED')),
    holder             VARCHAR(120),
    storage_location   VARCHAR(200),
    handed_over_at     TIMESTAMPTZ,
    last_read_test_at  TIMESTAMPTZ,
    last_read_test_result VARCHAR(10) CHECK (last_read_test_result IN ('PASSED', 'FAILED')),
    expires_on         DATE,
    destruction_record TEXT,
    holds_legal_hold   BOOLEAN      NOT NULL DEFAULT FALSE,
    registered_by      VARCHAR(120) NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE media_event (
    id        BIGSERIAL PRIMARY KEY,
    media_id  UUID         NOT NULL REFERENCES offline_media (id),
    event     VARCHAR(30)  NOT NULL,
    by_user   VARCHAR(120) NOT NULL,
    at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail_json JSONB
);
CREATE INDEX media_event_media_idx ON media_event (media_id, at DESC);
CREATE TRIGGER media_event_append_only BEFORE UPDATE OR DELETE ON media_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE SEQUENCE backup_export_seq;
CREATE TABLE backup_export (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id        VARCHAR(30)  NOT NULL UNIQUE,
    run_id           UUID         NOT NULL REFERENCES backup_run (id),
    media_id         UUID         NOT NULL REFERENCES offline_media (id),
    status           VARCHAR(20)  NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'INVALID', 'REJECTED')),
    requested_by     VARCHAR(120) NOT NULL,
    reason           TEXT         NOT NULL,
    requested_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    approved_by      VARCHAR(120),
    decided_at       TIMESTAMPTZ,
    decision_reason  TEXT,
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    estimated_bytes  BIGINT,
    size_bytes       BIGINT,
    file_count       INTEGER,
    receipt_sha256   CHAR(64),
    package_path     TEXT,
    error_code       VARCHAR(60),
    error_detail     TEXT,
    notes_json       JSONB,
    CONSTRAINT backup_export_two_people CHECK (approved_by IS NULL OR lower(approved_by) <> lower(requested_by))
);
-- a medium takes one package at a time
CREATE UNIQUE INDEX backup_export_one_open_per_media ON backup_export (media_id) WHERE status IN ('REQUESTED', 'APPROVED', 'RUNNING');
CREATE INDEX backup_export_run_idx ON backup_export (run_id);

ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN ('BACKUP_DB', 'VERIFY', 'EXPORT'));
