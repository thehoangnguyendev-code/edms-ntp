ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS font_family VARCHAR(100);
ALTER TABLE email_template_versions ADD COLUMN IF NOT EXISTS font_family VARCHAR(100);
