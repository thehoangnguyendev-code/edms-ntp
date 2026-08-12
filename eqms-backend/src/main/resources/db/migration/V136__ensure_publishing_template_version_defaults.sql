ALTER TABLE publishing_templates
    ALTER COLUMN version_number SET DEFAULT 1;

UPDATE publishing_templates
SET version_number = COALESCE(version_number, 1)
WHERE version_number IS NULL;

ALTER TABLE publishing_template_versions
    ALTER COLUMN version_number SET DEFAULT 1;

UPDATE publishing_template_versions
SET version_number = COALESCE(version_number, 1)
WHERE version_number IS NULL;
