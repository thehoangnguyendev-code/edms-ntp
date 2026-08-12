ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS obsolete_reason VARCHAR(80),
    ADD COLUMN IF NOT EXISTS controlled_copy_file_path VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS controlled_copy_storage_provider VARCHAR(60),
    ADD COLUMN IF NOT EXISTS controlled_copy_storage_bucket VARCHAR(255),
    ADD COLUMN IF NOT EXISTS controlled_copy_storage_object_key VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS controlled_copy_storage_version_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS controlled_copy_checksum VARCHAR(128);

UPDATE controlled_copies
SET status_code = 'OBSOLETED'
WHERE UPPER(COALESCE(status_code, '')) IN ('OBSOLETE', 'OBSOLETED')
   OR UPPER(COALESCE(status, '')) = 'OBSOLETED';

UPDATE controlled_copies
SET status = 'Obsoleted'
WHERE status_code = 'OBSOLETED';

UPDATE controlled_copy_distribution_batches
SET status_code = 'OBSOLETED'
WHERE UPPER(COALESCE(status_code, '')) IN ('OBSOLETE', 'OBSOLETED')
   OR UPPER(COALESCE(status, '')) = 'OBSOLETED';

UPDATE controlled_copy_distribution_batches
SET status = 'Obsoleted'
WHERE status_code = 'OBSOLETED';
