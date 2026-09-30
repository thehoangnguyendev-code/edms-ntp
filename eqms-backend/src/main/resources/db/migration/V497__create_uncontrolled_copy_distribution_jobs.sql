-- V497: Async distribution job/item tables for Uncontrolled Copy, structurally identical to
-- controlled_copy_distribution_jobs / controlled_copy_distribution_job_items (PENDING ->
-- PROCESSING -> SUCCESS/FAILED/SKIPPED), but referencing uncontrolled_copies directly since
-- Uncontrolled Copy has no distribution-batch concept.

CREATE TABLE uncontrolled_copy_distribution_jobs (
    id                      UUID PRIMARY KEY,
    uncontrolled_copy_id    UUID NOT NULL REFERENCES uncontrolled_copies(id),
    requested_by_user_id    UUID NOT NULL REFERENCES app_users(id),
    action_type             VARCHAR(20) NOT NULL DEFAULT 'DISTRIBUTE',
    status                  VARCHAR(32) NOT NULL,
    total_items             INTEGER NOT NULL DEFAULT 0,
    succeeded_items         INTEGER NOT NULL DEFAULT 0,
    failed_items            INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ
);

CREATE TABLE uncontrolled_copy_distribution_job_items (
    id                      UUID PRIMARY KEY,
    job_id                  UUID NOT NULL REFERENCES uncontrolled_copy_distribution_jobs(id),
    uncontrolled_copy_id    UUID NOT NULL REFERENCES uncontrolled_copies(id),
    recipient_email         VARCHAR(255),
    status                  VARCHAR(32) NOT NULL,
    attempts                INTEGER NOT NULL DEFAULT 0,
    last_error_code         VARCHAR(80),
    last_error_message      TEXT,
    processing_started_at   TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_ucdj_uncontrolled_copy_id ON uncontrolled_copy_distribution_jobs(uncontrolled_copy_id);
CREATE INDEX idx_ucdj_status ON uncontrolled_copy_distribution_jobs(status);
CREATE INDEX idx_ucdji_job_id ON uncontrolled_copy_distribution_job_items(job_id);
CREATE INDEX idx_ucdji_status ON uncontrolled_copy_distribution_job_items(status);
