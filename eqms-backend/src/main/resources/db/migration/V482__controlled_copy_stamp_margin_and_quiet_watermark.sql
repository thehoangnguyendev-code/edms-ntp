-- Stamp distance from the page edge is now configurable (millimetres; the corner is already selectable).
-- The watermark is drawn behind the page content and, by default, carries only its title and the copy number (recipient, distribution
-- and expiry dates are on the stamp / in the document and made the watermark hard to read).
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS stamp_margin_mm INTEGER NOT NULL DEFAULT 4,
    ALTER COLUMN watermark_recipient SET DEFAULT FALSE,
    ALTER COLUMN watermark_distributed_date SET DEFAULT FALSE,
    ALTER COLUMN watermark_expiry_date SET DEFAULT FALSE;

UPDATE controlled_copy_policy_settings
SET watermark_recipient = FALSE, watermark_distributed_date = FALSE, watermark_expiry_date = FALSE
WHERE watermark_recipient = TRUE AND watermark_distributed_date = TRUE AND watermark_expiry_date = TRUE;
