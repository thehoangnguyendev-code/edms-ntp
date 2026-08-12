ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS entity_name VARCHAR(255);

UPDATE audit_logs
SET entity_name = COALESCE(entity_name, entity_type)
WHERE entity_name IS NULL;
