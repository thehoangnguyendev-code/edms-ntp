CREATE TABLE controlled_copy_distribution_jobs (
    id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES controlled_copy_distribution_batches(id),
    requested_by_user_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(32) NOT NULL,
    total_items INTEGER NOT NULL,
    succeeded_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL
);

CREATE TABLE controlled_copy_distribution_job_items (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES controlled_copy_distribution_jobs(id) ON DELETE CASCADE,
    controlled_copy_id UUID NOT NULL REFERENCES controlled_copies(id),
    status VARCHAR(32) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error_code VARCHAR(80) NULL,
    last_error_message TEXT NULL,
    processing_started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    UNIQUE(job_id, controlled_copy_id)
);

CREATE INDEX idx_cc_distribution_job_items_pending ON controlled_copy_distribution_job_items(status, processing_started_at);
