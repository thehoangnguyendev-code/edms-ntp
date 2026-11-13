-- DEV only. The New Access Profile wizard lists users (needs settings.user.view). The security test profile did not have it,
-- so the "Users" step failed with "Failed to load users". Give the DEV test profile that permission through its own test set.
-- Restart the backend afterwards: permissions are cached.
BEGIN;
INSERT INTO permission_sets (id, name, code, description, active, system, version, test_data)
SELECT gen_random_uuid(), 'DCV Security: view users (DEV test)', 'PS_DCV_SECURITY_USER_VIEW', 'DEV test: lets the security test account list users in the profile wizard.', TRUE, FALSE, 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_DCV_SECURITY_USER_VIEW');
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code = 'settings.user.view'
WHERE ps.code = 'PS_DCV_SECURITY_USER_VIEW'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_DCV_SECURITY_USER_VIEW' WHERE r.code = 'DCV_SECURITY'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);
COMMIT;
