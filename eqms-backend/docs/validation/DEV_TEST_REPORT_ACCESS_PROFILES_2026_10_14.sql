-- DEV test access profiles for Report Administration (owner instruction, 2026-10-14).
-- Two permission sets, two access profiles (roles), assigned to the test accounts admin and approver.test1.
-- A user keeps the profiles already assigned; these are added. Each step checks that it is not already present.
BEGIN;

-- Permission sets
INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Report Author and Administrator (DEV test)', 'PS_REPORT_AUTHOR_DEV_TEST',
       'DEV test: create report templates and rules, submit, run and schedule reports.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_REPORT_AUTHOR_DEV_TEST');

INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Report Template Approver (DEV test)', 'PS_REPORT_APPROVER_DEV_TEST',
       'DEV test: approve or return report templates, and run approved reports.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_REPORT_APPROVER_DEV_TEST');

-- Permissions of the author set
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('report.module.view', 'report.module.export', 'reports.catalog.view', 'reports.definition.view',
     'reports.definition.manage', 'reports.name_format.manage', 'reports.run.create', 'reports.run.view_own', 'reports.run.view_all',
     'reports.artifact.download', 'reports.schedule.view', 'reports.schedule.manage',
     'reports.definition.upgrade', 'reports.definition.discard_revision', 'reports.definition.set_enabled',
     'reports.properties.view', 'reports.properties.manage')
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

-- Permissions of the approver set
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('report.module.view', 'reports.catalog.view', 'reports.definition.view', 'reports.definition.approve',
     'reports.run.create', 'reports.run.view_own', 'reports.artifact.download')
WHERE ps.code = 'PS_REPORT_APPROVER_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

-- Access profiles (roles)
INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'REPORT_AUTHOR_DEV_TEST', 'Report Author and Administrator (DEV test)',
       'DEV test: report template authoring, name rules, runs and schedules.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'REPORT_AUTHOR_DEV_TEST');

INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'REPORT_APPROVER_DEV_TEST', 'Report Template Approver (DEV test)',
       'DEV test: approval of report templates, and running approved reports.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'REPORT_APPROVER_DEV_TEST');

-- Profile -> permission set
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
WHERE r.code = 'REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_REPORT_APPROVER_DEV_TEST'
WHERE r.code = 'REPORT_APPROVER_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

-- User -> access profile (a user may hold several profiles)
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'REPORT_AUTHOR_DEV_TEST'
WHERE u.username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'REPORT_APPROVER_DEV_TEST'
WHERE u.username = 'approver.test1'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);

COMMIT;
