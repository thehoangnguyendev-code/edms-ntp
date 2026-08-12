-- Full removal of an external Microsoft Entra guest object is a distinct, irreversible
-- capability from "Disable Microsoft Access" (which only revokes sign-in). Keep it
-- permission-gated separately so it can be granted/restricted independently.
INSERT INTO permissions (id, code, name, description, category, module_key, group_key, display_order, requires_audit)
VALUES
 (gen_random_uuid(), 'users.remove_external_identity', 'Remove external user', 'Permanently remove the Microsoft Entra guest account (irreversible)', 'System Administration', 'settings', 'user_management', 915, true)
ON CONFLICT (code) DO UPDATE SET
 name = EXCLUDED.name,
 description = EXCLUDED.description,
 category = EXCLUDED.category,
 module_key = EXCLUDED.module_key,
 group_key = EXCLUDED.group_key,
 requires_audit = EXCLUDED.requires_audit;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'users.remove_external_identity'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
  AND NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
  );
