ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS source_storage_version_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_document_revisions_source_object_version
    ON document_revisions (source_storage_bucket, source_storage_object_key, source_storage_version_id);
