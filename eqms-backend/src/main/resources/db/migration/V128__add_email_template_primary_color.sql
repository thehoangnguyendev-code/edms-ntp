ALTER TABLE email_templates
    ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#059669';

ALTER TABLE email_template_versions
    ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20);

UPDATE email_templates SET primary_color = '#059669' WHERE primary_color IS NULL;
