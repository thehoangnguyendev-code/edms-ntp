-- Control plane of the eQMS Backup Agent (SDS-BR-001 section 17).
-- This database is separate from the eQMS database on purpose: restoring the eQMS database must never replace the
-- history of backups, restores and approvals. Every timestamp is UTC. Machine values are codes, never display text.

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------ policy (versioned, never edited in place)
CREATE TABLE backup_policy (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version                    INTEGER      NOT NULL UNIQUE,
    status                     VARCHAR(20)  NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUPERSEDED')),
    scope_json                 JSONB        NOT NULL,
    schedule_json              JSONB        NOT NULL,
    retention_json             JSONB        NOT NULL,
    targets_json               JSONB        NOT NULL,
    encryption_key_fingerprint VARCHAR(80),
    proposed_by                VARCHAR(120),
    approved_by                VARCHAR(120),
    reason                     TEXT,
    approval_signature_ref     VARCHAR(120),
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT backup_policy_two_people CHECK (proposed_by IS NULL OR approved_by IS NULL OR proposed_by <> approved_by)
);
CREATE UNIQUE INDEX backup_policy_one_active ON backup_policy (status) WHERE status = 'ACTIVE';

-- ------------------------------------------------------------------ runs
CREATE TABLE backup_day_sequence (
    day  DATE PRIMARY KEY,
    last INTEGER NOT NULL
);

CREATE TABLE backup_run (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id      VARCHAR(40)  NOT NULL UNIQUE,
    environment    VARCHAR(10)  NOT NULL CHECK (environment IN ('DEV', 'TEST', 'PROD')),
    type           VARCHAR(20)  NOT NULL CHECK (type IN ('FULL', 'INCREMENTAL', 'PRE_CHANGE', 'PRE_RESTORE')),
    trigger_kind   VARCHAR(20)  NOT NULL CHECK (trigger_kind IN ('SCHEDULED', 'MANUAL', 'PRE_CHANGE')),
    status         VARCHAR(20)  NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    policy_version INTEGER,
    started_at     TIMESTAMPTZ  NOT NULL,
    finished_at    TIMESTAMPTZ,
    db_snapshot_at TIMESTAMPTZ,
    object_listed_at TIMESTAMPTZ,
    size_bytes     BIGINT,
    error_code     VARCHAR(80),
    error_detail   TEXT,
    requested_by   VARCHAR(120) NOT NULL,
    reason         TEXT,
    change_control_ref VARCHAR(120),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX backup_run_started_idx ON backup_run (started_at DESC);
CREATE INDEX backup_run_status_idx ON backup_run (status);

-- only one run may be RUNNING at a time per environment
CREATE UNIQUE INDEX backup_run_one_running ON backup_run (environment) WHERE status = 'RUNNING';

CREATE TABLE backup_component_result (
    run_id          UUID        NOT NULL REFERENCES backup_run (id),
    component       VARCHAR(20) NOT NULL CHECK (component IN ('DATABASE', 'OBJECT_STORE', 'FILE_STORAGE', 'CONFIGURATION')),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'SKIPPED')),
    size_bytes      BIGINT,
    object_count    BIGINT,
    sha256          CHAR(64),
    row_counts_json JSONB,
    PRIMARY KEY (run_id, component)
);
CREATE TRIGGER backup_component_result_append_only BEFORE UPDATE OR DELETE ON backup_component_result
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE backup_set_location (
    run_id          UUID         NOT NULL REFERENCES backup_run (id),
    target_code     VARCHAR(40)  NOT NULL,
    path            TEXT         NOT NULL,
    written_at      TIMESTAMPTZ  NOT NULL,
    readback_sha256 CHAR(64),
    ok              BOOLEAN      NOT NULL,
    PRIMARY KEY (run_id, target_code)
);
CREATE TRIGGER backup_set_location_append_only BEFORE UPDATE OR DELETE ON backup_set_location
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- The exact bytes that were signed are kept as text so the signature can be checked years later.
CREATE TABLE backup_manifest (
    run_id                   UUID PRIMARY KEY REFERENCES backup_run (id),
    manifest_text            TEXT        NOT NULL,
    manifest_sha256          CHAR(64)    NOT NULL,
    signature_base64         TEXT        NOT NULL,
    signing_key_id           VARCHAR(40) NOT NULL,
    previous_manifest_sha256 CHAR(64)
);
CREATE TRIGGER backup_manifest_append_only BEFORE UPDATE OR DELETE ON backup_manifest
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE backup_verification (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID         NOT NULL REFERENCES backup_run (id),
    tier        VARCHAR(4)   NOT NULL CHECK (tier IN ('V1', 'V2', 'V3', 'V4')),
    result      VARCHAR(20)  NOT NULL CHECK (result IN ('VERIFIED', 'FAILED')),
    detail_json JSONB        NOT NULL,
    verified_at TIMESTAMPTZ  NOT NULL,
    verified_by VARCHAR(120) NOT NULL
);
CREATE INDEX backup_verification_run_idx ON backup_verification (run_id, verified_at DESC);
CREATE TRIGGER backup_verification_append_only BEFORE UPDATE OR DELETE ON backup_verification
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ------------------------------------------------------------------ queue of work for the agent
CREATE TABLE backup_job (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type     VARCHAR(30)  NOT NULL CHECK (job_type IN ('BACKUP_DB', 'VERIFY')),
    payload_json JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status       VARCHAR(20)  NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED')),
    lease_until  TIMESTAMPTZ,
    attempts     INTEGER      NOT NULL DEFAULT 0,
    requested_by VARCHAR(120) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    result_json  JSONB
);
CREATE INDEX backup_job_queue_idx ON backup_job (status, created_at);

-- ------------------------------------------------------------------ alerts
CREATE TABLE backup_alert (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    severity        VARCHAR(12)  NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
    code            VARCHAR(80)  NOT NULL,
    detail          TEXT,
    ref             VARCHAR(80),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(120)
);
CREATE INDEX backup_alert_open_idx ON backup_alert (at DESC) WHERE acknowledged_at IS NULL;

-- ------------------------------------------------------------------ ledger: append-only, hash-chained (SDS section 8.3)
CREATE TABLE ledger_event (
    seq       BIGINT PRIMARY KEY,
    at        TIMESTAMPTZ  NOT NULL,
    actor     VARCHAR(160) NOT NULL,
    event     VARCHAR(60)  NOT NULL,
    ref       VARCHAR(80),
    data_json TEXT         NOT NULL,
    prev_hash CHAR(64)     NOT NULL,
    hash      CHAR(64)     NOT NULL UNIQUE
);
CREATE TRIGGER ledger_event_append_only_row BEFORE UPDATE OR DELETE ON ledger_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_event_append_only_stmt BEFORE TRUNCATE ON ledger_event
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- ------------------------------------------------------------------ first policy (DEV default). Later versions go through approval.
INSERT INTO backup_policy (version, status, scope_json, schedule_json, retention_json, targets_json, reason)
VALUES (1, 'ACTIVE',
        '{"components":["DATABASE"]}'::jsonb,
        '{"database":{"enabled":true,"frequency":"DAILY","time":"02:00","type":"FULL"}}'::jsonb,
        '{"mode":"PERMANENT"}'::jsonb,
        '{"targets":[{"code":"T1","kind":"SERVER_FOLDER","role":"PRIMARY"}]}'::jsonb,
        'Initial policy created by the agent installation (DEV)');
