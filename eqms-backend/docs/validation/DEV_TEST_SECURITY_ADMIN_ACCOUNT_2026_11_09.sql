-- DEV only. One test account that can open the Security & Authorization screens (to take screenshots and test them).
-- Password = the admin account's hash (the shared DEV test password). Restart the backend afterwards: permissions are cached.
-- Run after V748 (test_data column).
BEGIN;
INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at, test_data)
SELECT gen_random_uuid(), 'DCV_SECURITY', 'Security Authorization Manager (DEV test)', 'DEV test: opens the Security & Authorization screens.', FALSE, TRUE, 'CUSTOM', 0, now(), now(), TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'DCV_SECURITY');

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_MODULE_SECURITY_AUTHORIZATION_MANAGER'
WHERE r.code = 'DCV_SECURITY'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), 'dcv.secadmin', 'dcv.secadmin@example.local', 'DCV Security Manager', (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       'Quality Control', 'QC Specialist', 'Active', 'TEST-DCV-09', 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'dcv.secadmin');

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'DCV_SECURITY' WHERE u.username = 'dcv.secadmin'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
COMMIT;
