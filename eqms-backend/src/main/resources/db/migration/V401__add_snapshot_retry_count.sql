-- Backs the automatic review-snapshot retry mechanism (bounded to
-- RevisionSnapshotRetryScheduler.MAX_ATTEMPTS): tracks how many scheduler-driven retries a
-- revision's review snapshot generation has already had, so the scheduler stops retrying a
-- permanently-broken source file instead of looping forever.
ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS snapshot_retry_count INT NOT NULL DEFAULT 0;
