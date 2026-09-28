-- Publishing Template integrity for Controlled Copy (see docs/CONTROLLED_COPY_ENHANCEMENT_CHANGE_RECORD.md).
--
-- 1. Only one Publishing Template may be live (ACTIVE/PUBLISHED) at a time. The application retires the previous one
--    when another is published; this index makes the database refuse a second live template regardless.
-- 2. Header/footer/watermark page ranges chosen in the Publishing Workspace belong to that Revision, not to the shared
--    template: they are stored on revision_publishing_metadata so a later Controlled Copy can be composed identically.
-- 3. Lineage of a new template version (which template it supersedes).
CREATE UNIQUE INDEX IF NOT EXISTS uq_publishing_templates_single_live
    ON publishing_templates ((1))
    WHERE upper(status) IN ('ACTIVE', 'PUBLISHED');

ALTER TABLE revision_publishing_metadata
    ADD COLUMN IF NOT EXISTS header_page_from INTEGER,
    ADD COLUMN IF NOT EXISTS header_page_to INTEGER,
    ADD COLUMN IF NOT EXISTS footer_page_from INTEGER,
    ADD COLUMN IF NOT EXISTS footer_page_to INTEGER,
    ADD COLUMN IF NOT EXISTS watermark_page_from INTEGER,
    ADD COLUMN IF NOT EXISTS watermark_page_to INTEGER,
    ADD COLUMN IF NOT EXISTS page_ranges_recorded BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE publishing_templates
    ADD COLUMN IF NOT EXISTS supersedes_template_id UUID REFERENCES publishing_templates(id);
