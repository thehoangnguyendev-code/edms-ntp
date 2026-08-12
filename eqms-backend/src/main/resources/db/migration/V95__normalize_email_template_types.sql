-- Normalize email template type values to canonical lowercase-hyphen form.
UPDATE email_templates
SET type = lower(trim(type))
WHERE type IS NOT NULL
  AND type <> lower(trim(type));

UPDATE email_template_versions
SET type = lower(trim(type))
WHERE type IS NOT NULL
  AND type <> lower(trim(type));
