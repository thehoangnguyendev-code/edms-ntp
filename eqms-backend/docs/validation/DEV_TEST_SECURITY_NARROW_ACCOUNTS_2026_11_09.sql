-- DEV only. Two narrow test accounts for the New Access Profile screens (button by permission, wizard without settings.user.view).
-- dcv.sec.upd = view + update only (no assign); dcv.sec.nouser = view + update + assign, no settings.user.view.
-- Password = the admin account's hash (shared DEV test password). Restart the backend afterwards: permissions are cached.
BEGIN;
INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at, test_data)
SELECT gen_random_uuid(), 'DCV_SEC_UPDATE_ONLY', 'DCV Security update only (DEV test)', 'DEV test: narrow security permissions.', FALSE, TRUE, 'CUSTOM', 0, now(), now(), TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'DCV_SEC_UPDATE_ONLY');
INSERT INTO permission_sets (id, name, code, description, active, system, version, test_data)
SELECT gen_random_uuid(), 'DCV Security update only (DEV test) permissions', 'PS_DCV_SEC_UPDATE_ONLY', 'DEV test', TRUE, FALSE, 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_DCV_SEC_UPDATE_ONLY');
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('dashboard.module.view','security.access_profiles.view','security.access_profiles.update','security.permission_sets.view') WHERE ps.code = 'PS_DCV_SEC_UPDATE_ONLY'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_DCV_SEC_UPDATE_ONLY' WHERE r.code = 'DCV_SEC_UPDATE_ONLY'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), 'dcv.sec.upd', 'dcv.sec.upd@example.local', 'DCV Security update only (DEV test)', (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       'Quality Control', 'QC Specialist', 'Active', 'TEST-DCV-10', 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'dcv.sec.upd');
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'DCV_SEC_UPDATE_ONLY' WHERE u.username = 'dcv.sec.upd'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);

INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at, test_data)
SELECT gen_random_uuid(), 'DCV_SEC_NO_USER_VIEW', 'DCV Security no user list (DEV test)', 'DEV test: narrow security permissions.', FALSE, TRUE, 'CUSTOM', 0, now(), now(), TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'DCV_SEC_NO_USER_VIEW');
INSERT INTO permission_sets (id, name, code, description, active, system, version, test_data)
SELECT gen_random_uuid(), 'DCV Security no user list (DEV test) permissions', 'PS_DCV_SEC_NO_USER_VIEW', 'DEV test', TRUE, FALSE, 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_DCV_SEC_NO_USER_VIEW');
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('dashboard.module.view','security.access_profiles.view','security.access_profiles.update','security.access_profiles.assign','security.permission_sets.view') WHERE ps.code = 'PS_DCV_SEC_NO_USER_VIEW'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_DCV_SEC_NO_USER_VIEW' WHERE r.code = 'DCV_SEC_NO_USER_VIEW'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), 'dcv.sec.nouser', 'dcv.sec.nouser@example.local', 'DCV Security no user list (DEV test)', (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       'Quality Control', 'QC Specialist', 'Active', 'TEST-DCV-11', 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'dcv.sec.nouser');
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'DCV_SEC_NO_USER_VIEW' WHERE u.username = 'dcv.sec.nouser'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
COMMIT;
