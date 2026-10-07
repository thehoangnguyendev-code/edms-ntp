-- V549: Which pages carry the scan code (owner decision 2026-10-07).
-- ALL = every page (needed to sort loose pages of many copies back together when they are scanned as one file); FIRST = the first page
-- only (then a scan of loose pages cannot be sorted, only a whole copy can be matched from its first page).
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS qr_code_pages VARCHAR(10) NOT NULL DEFAULT 'ALL';
