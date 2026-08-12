ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(60),
    ADD COLUMN IF NOT EXISTS storage_site_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_drive_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_item_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS storage_web_url VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_edit_url VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_view_url VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_pdf_url VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS storage_sync_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS storage_last_synced_at TIMESTAMP WITH TIME ZONE;
