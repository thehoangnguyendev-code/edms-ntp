ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS has_expiry_date BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMP NULL;

ALTER TABLE controlled_copy_distribution_batches
    ADD COLUMN IF NOT EXISTS has_expiry_date BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_controlled_copies_expiry_schedule
    ON controlled_copies(status_code, has_expiry_date, expiry_date, expiry_reminder_sent_at);

CREATE INDEX IF NOT EXISTS idx_controlled_copy_batches_expiry
    ON controlled_copy_distribution_batches(has_expiry_date, expiry_date);
