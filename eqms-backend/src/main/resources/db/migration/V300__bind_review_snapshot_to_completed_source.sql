-- A review snapshot is valid only for the immutable source that was completed.
-- The request id makes asynchronous rendering safe when an older render finishes late.
ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS snapshot_request_id UUID;

ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS snapshot_source_checksum VARCHAR(128);

ALTER TABLE revision_snapshot_history
    ADD COLUMN IF NOT EXISTS source_checksum VARCHAR(128);

ALTER TABLE revision_snapshot_history
    ADD COLUMN IF NOT EXISTS generation_request_id UUID;

-- Preserve readable legacy snapshots only when they match the revision's current source.
UPDATE document_revisions
SET snapshot_source_checksum = source_file_checksum
WHERE snapshot_status = 'READY'
  AND preview_file_path IS NOT NULL
  AND snapshot_source_checksum IS NULL
  AND source_file_checksum IS NOT NULL;
