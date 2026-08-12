CREATE INDEX IF NOT EXISTS idx_cc_distribution_jobs_status_created
    ON controlled_copy_distribution_jobs (status, created_at);
