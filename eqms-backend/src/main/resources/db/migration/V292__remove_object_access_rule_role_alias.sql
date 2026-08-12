-- Object Access Rules were migrated to Access Profile subjects in V234.
-- Remove the obsolete role_id compatibility column so there is one canonical
-- authorization subject model: access_profile_object_rules.
INSERT INTO access_profile_object_rules (access_profile_id, object_access_rule_id)
SELECT role_id, id
FROM object_access_rules
WHERE role_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS idx_oar_role;
ALTER TABLE object_access_rules DROP COLUMN IF EXISTS role_id;
