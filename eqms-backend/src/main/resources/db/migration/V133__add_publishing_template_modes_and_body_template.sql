ALTER TABLE publishing_templates
    ADD COLUMN IF NOT EXISTS body_template_path VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS body_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS publishing_mode VARCHAR(40),
    ADD COLUMN IF NOT EXISTS cover_orientation VARCHAR(20),
    ADD COLUMN IF NOT EXISTS body_orientation VARCHAR(20);

ALTER TABLE publishing_template_versions
    ADD COLUMN IF NOT EXISTS body_template_path VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS body_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS publishing_mode VARCHAR(40),
    ADD COLUMN IF NOT EXISTS cover_orientation VARCHAR(20),
    ADD COLUMN IF NOT EXISTS body_orientation VARCHAR(20);

UPDATE publishing_templates
SET publishing_mode = COALESCE(publishing_mode, 'COVER_ONLY'),
    cover_orientation = COALESCE(cover_orientation, 'USE_SOURCE'),
    body_orientation = COALESCE(body_orientation, 'USE_SOURCE');

UPDATE publishing_template_versions
SET publishing_mode = COALESCE(publishing_mode, 'COVER_ONLY'),
    cover_orientation = COALESCE(cover_orientation, 'USE_SOURCE'),
    body_orientation = COALESCE(body_orientation, 'USE_SOURCE');
