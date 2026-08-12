-- Allow the Admin (SYSTEM_ADMINISTRATION) permission set to configure notification policies
-- directly, in addition to the Settings Manager permission set.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'settings.notification_policy.manage'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
  AND NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
  );
