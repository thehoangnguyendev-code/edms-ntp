-- Font family for the issued-copy stamp and watermark (per-status stamp/watermark keeps its own
-- font family inside the existing status_marking jsonb, no column needed for that).
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN stamp_font_family VARCHAR(20) NOT NULL DEFAULT 'NOTO_SANS',
    ADD COLUMN watermark_font_family VARCHAR(20) NOT NULL DEFAULT 'NOTO_SANS';
