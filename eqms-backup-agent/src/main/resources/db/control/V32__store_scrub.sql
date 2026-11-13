-- The periodic check of the live file store (SDS-BR-004 2.4). It reads the store and compares each file with the index of the newest
-- backup and, for documents, with the checksum recorded when they were signed. It only reports; it never repairs. One row per run.
CREATE TABLE store_scrub_run (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_kind          VARCHAR(12)  NOT NULL CHECK (trigger_kind IN ('SCHEDULED', 'MANUAL')),
    requested_by          VARCHAR(120) NOT NULL,
    started_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at           TIMESTAMPTZ,
    status                VARCHAR(10)  NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    backup_number         VARCHAR(40),
    checked_files         BIGINT       NOT NULL DEFAULT 0,
    checked_bytes         BIGINT       NOT NULL DEFAULT 0,
    different_files       INTEGER      NOT NULL DEFAULT 0,
    missing_files         INTEGER      NOT NULL DEFAULT 0,
    reference_differences INTEGER      NOT NULL DEFAULT 0,
    error_code            VARCHAR(60),
    detail_json           JSONB
);
CREATE INDEX store_scrub_run_started_idx ON store_scrub_run (started_at DESC);
