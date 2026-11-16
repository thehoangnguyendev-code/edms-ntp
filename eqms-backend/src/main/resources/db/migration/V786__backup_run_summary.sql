-- REPORT-BACKUP-RUNS-2026-11-15: a copy of the summary of each backup, verification, restore, rehearsal and store scrub, read from the backup control database
-- through a read-only login and kept here for the Backup and Restore Runs report. The control database stays the record; this is a copy that is refreshed,
-- never edited by a person. Only the summary is copied: no error text, path, key or manifest.
CREATE TABLE IF NOT EXISTS backup_run_summary (
    kind               VARCHAR(20)  NOT NULL,
    source_id          UUID         NOT NULL,
    reference          VARCHAR(200),
    backup_number      VARCHAR(100),
    status             VARCHAR(60),
    trigger_kind       VARCHAR(60),
    run_type           VARCHAR(60),
    environment        VARCHAR(30),
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ,
    actor              VARCHAR(200),
    size_bytes         BIGINT,
    tier               VARCHAR(60),
    error_code         VARCHAR(100),
    failed_step        VARCHAR(100),
    restore_seconds    INTEGER,
    checked_files      BIGINT,
    different_files    INTEGER,
    missing_files      INTEGER,
    reason             TEXT,
    change_control_ref VARCHAR(200),
    synced_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, source_id)
);
CREATE INDEX IF NOT EXISTS idx_backup_run_summary_started ON backup_run_summary (started_at DESC);

-- When the copy was last refreshed and how it ended, so a report can say how current it is.
CREATE TABLE IF NOT EXISTS backup_run_summary_sync (
    id              SMALLINT PRIMARY KEY CHECK (id = 1),
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_rows       INTEGER,
    last_error      VARCHAR(300)
);
INSERT INTO backup_run_summary_sync (id) VALUES (1) ON CONFLICT DO NOTHING;
