ALTER TABLE controlled_copy_distribution_jobs
    ADD COLUMN action_type VARCHAR(20) NOT NULL DEFAULT 'DISTRIBUTE';

CREATE INDEX IF NOT EXISTS idx_controlled_copy_distribution_jobs_batch_action
    ON controlled_copy_distribution_jobs (batch_id, action_type);
