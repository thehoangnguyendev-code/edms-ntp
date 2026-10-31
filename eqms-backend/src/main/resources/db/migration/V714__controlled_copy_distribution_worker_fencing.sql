ALTER TABLE controlled_copy_distribution_jobs
    ADD COLUMN execution_protocol VARCHAR(32),
    ADD COLUMN worker_token UUID,
    ADD COLUMN worker_lease_until TIMESTAMPTZ,
    ADD COLUMN execution_actor_id UUID REFERENCES app_users(id),
    ADD COLUMN worker_notify_zip BOOLEAN NOT NULL DEFAULT true;

-- Existing PROCESSING rows deliberately remain unowned: their external outcomes need reconciliation.
CREATE INDEX idx_cc_distribution_recoverable
    ON controlled_copy_distribution_jobs(worker_lease_until,created_at)
    WHERE action_type='DISTRIBUTE' AND execution_protocol='FENCED_V1' AND status='PROCESSING';
