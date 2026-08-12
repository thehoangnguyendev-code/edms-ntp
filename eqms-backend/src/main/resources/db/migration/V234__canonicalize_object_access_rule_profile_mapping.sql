-- Canonicalize rule subjects through access_profile_object_rules.  role_id remains readable
-- for rollback/compatibility, but all application writes use the join table from this migration.
INSERT INTO access_profile_object_rules (access_profile_id, object_access_rule_id)
SELECT role_id, id
FROM object_access_rules
WHERE role_id IS NOT NULL
ON CONFLICT DO NOTHING;
