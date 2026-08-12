ALTER TABLE publishing_templates
    ADD COLUMN IF NOT EXISTS cover_source_page_from integer,
    ADD COLUMN IF NOT EXISTS cover_source_page_to integer,
    ADD COLUMN IF NOT EXISTS body_source_page_from integer,
    ADD COLUMN IF NOT EXISTS body_source_page_to integer,
    ADD COLUMN IF NOT EXISTS header_page_from integer,
    ADD COLUMN IF NOT EXISTS header_page_to integer,
    ADD COLUMN IF NOT EXISTS footer_page_from integer,
    ADD COLUMN IF NOT EXISTS footer_page_to integer,
    ADD COLUMN IF NOT EXISTS watermark_page_from integer,
    ADD COLUMN IF NOT EXISTS watermark_page_to integer;

ALTER TABLE publishing_template_versions
    ADD COLUMN IF NOT EXISTS cover_source_page_from integer,
    ADD COLUMN IF NOT EXISTS cover_source_page_to integer,
    ADD COLUMN IF NOT EXISTS body_source_page_from integer,
    ADD COLUMN IF NOT EXISTS body_source_page_to integer,
    ADD COLUMN IF NOT EXISTS header_page_from integer,
    ADD COLUMN IF NOT EXISTS header_page_to integer,
    ADD COLUMN IF NOT EXISTS footer_page_from integer,
    ADD COLUMN IF NOT EXISTS footer_page_to integer,
    ADD COLUMN IF NOT EXISTS watermark_page_from integer,
    ADD COLUMN IF NOT EXISTS watermark_page_to integer;

UPDATE publishing_templates
SET
    cover_source_page_from = COALESCE(cover_source_page_from, 1),
    cover_source_page_to = COALESCE(cover_source_page_to, 1),
    body_source_page_from = COALESCE(body_source_page_from, 1)
WHERE cover_source_page_from IS NULL
   OR cover_source_page_to IS NULL
   OR body_source_page_from IS NULL;

UPDATE publishing_template_versions
SET
    cover_source_page_from = COALESCE(cover_source_page_from, 1),
    cover_source_page_to = COALESCE(cover_source_page_to, 1),
    body_source_page_from = COALESCE(body_source_page_from, 1)
WHERE cover_source_page_from IS NULL
   OR cover_source_page_to IS NULL
   OR body_source_page_from IS NULL;
