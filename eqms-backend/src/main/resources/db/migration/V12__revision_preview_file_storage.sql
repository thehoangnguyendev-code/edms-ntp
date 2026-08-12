ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS preview_file_path VARCHAR(1024);
