-- V548: One scan may hold the loose pages of many controlled copies (owner decision 2026-10-07).
--
-- Every page of a controlled copy now carries a QR code naming the copy, the page and the page count. An uploaded scan is read
-- page by page: pages are grouped by copy, put in page order and split into one file per copy; a page that cannot be recognised
-- becomes its own item that the DCO assigns by typing the controlled copy number and the page number. The columns below record
-- where each item came from, which pages it holds and how many the copy has, so completeness can be checked before signing.
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS source_file_name VARCHAR(255);
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS source_sha256 VARCHAR(64);
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS source_stored_path TEXT;
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS source_pages VARCHAR(1000);
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS page_numbers VARCHAR(1000);
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS expected_pages INTEGER;
ALTER TABLE controlled_copy_recall_items ADD COLUMN IF NOT EXISTS page_note VARCHAR(500);
