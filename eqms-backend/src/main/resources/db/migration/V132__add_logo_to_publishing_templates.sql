ALTER TABLE publishing_templates
    ADD COLUMN IF NOT EXISTS logo_template_path VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS logo_file_name VARCHAR(255);

ALTER TABLE publishing_template_versions
    ADD COLUMN IF NOT EXISTS logo_template_path VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS logo_file_name VARCHAR(255);
