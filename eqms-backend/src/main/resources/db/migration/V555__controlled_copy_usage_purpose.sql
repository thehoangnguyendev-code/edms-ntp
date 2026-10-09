-- V555: Usage purpose of a controlled copy (owner decision CC-PURPOSE-2026-10-07).
-- READ_AND_COMPLY: read and comply, nothing is written on it, recalled without a scan, no Record.
-- RECORD_KEEPING: written on by hand, becomes a Record when returned (recalled by scan).
-- NULL: copies issued before this change. They are left alone: nothing is back-filled or classified.
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS usage_purpose VARCHAR(30);
ALTER TABLE controlled_copy_distribution_batches
    ADD COLUMN IF NOT EXISTS usage_purpose VARCHAR(30);

ALTER TABLE controlled_copies
    ADD CONSTRAINT ck_controlled_copies_usage_purpose
    CHECK (usage_purpose IS NULL OR usage_purpose IN ('READ_AND_COMPLY', 'RECORD_KEEPING'));
ALTER TABLE controlled_copy_distribution_batches
    ADD CONSTRAINT ck_controlled_copy_batches_usage_purpose
    CHECK (usage_purpose IS NULL OR usage_purpose IN ('READ_AND_COMPLY', 'RECORD_KEEPING'));
