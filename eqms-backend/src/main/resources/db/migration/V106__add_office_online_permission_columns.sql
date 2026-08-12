ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS storage_edit_permission_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_view_permission_id VARCHAR(255);
