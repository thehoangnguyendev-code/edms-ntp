ALTER TABLE controlled_copy_evidence_files
    ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_content_type VARCHAR(120),
    ADD COLUMN IF NOT EXISTS original_file_size BIGINT,
    ADD COLUMN IF NOT EXISTS original_stored_path TEXT,
    ADD COLUMN IF NOT EXISTS original_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS watermarked_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS watermarked BOOLEAN NOT NULL DEFAULT FALSE;
