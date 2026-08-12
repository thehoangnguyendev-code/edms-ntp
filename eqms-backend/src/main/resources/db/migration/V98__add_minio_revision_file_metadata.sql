ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS source_storage_provider VARCHAR(60),
    ADD COLUMN IF NOT EXISTS source_storage_bucket VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_storage_object_key VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS source_file_checksum VARCHAR(128),
    ADD COLUMN IF NOT EXISTS source_uploaded_at TIMESTAMP WITH TIME ZONE;

UPDATE document_revisions
SET source_storage_provider = CASE
        WHEN file_path LIKE 'minio://%' THEN 'minio'
        WHEN file_path LIKE 'smb://%' OR file_path LIKE '\\%' THEN 'nas'
        WHEN file_path IS NOT NULL THEN 'local'
        ELSE NULL
    END,
    source_uploaded_at = COALESCE(source_uploaded_at, updated_at)
WHERE source_storage_provider IS NULL
  AND file_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_revisions_source_storage
    ON document_revisions (source_storage_provider, source_storage_bucket);
