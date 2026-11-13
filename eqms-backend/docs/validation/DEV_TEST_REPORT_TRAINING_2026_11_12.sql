-- DEV test access profiles for the Training Report Types (REPORT-TRAINING-SOURCES-2026-11-12). DEV only; the accounts are DEV test accounts.
-- Two permission sets and two access profiles (roles), added to the profiles a user already holds. Each step checks that it is not already present.
--   REPORT_TRAINING_RUNNER_DEV_TEST     run approved reports + the training permissions of the three Training screens, WITHOUT training.scope.all
--                                       -> assigned to uat31.head.qc (Quality Control) and uat31.head.qa (Quality Assurance)
--   REPORT_RUNNER_NO_TRAINING_DEV_TEST  run approved reports, no training permission
--                                       -> assigned to dcv.u2
-- Restart the backend after running this: effective permissions are cached.
BEGIN;

INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Report Runner with Training (DEV test)', 'PS_REPORT_TRAINING_RUNNER_DEV_TEST',
       'DEV test: run approved reports and view training records, activities and compliance of the own department.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_REPORT_TRAINING_RUNNER_DEV_TEST');

INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Report Runner without Training (DEV test)', 'PS_REPORT_RUNNER_NO_TRAINING_DEV_TEST',
       'DEV test: run approved reports; no training permission.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_REPORT_RUNNER_NO_TRAINING_DEV_TEST');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('report.module.view', 'reports.catalog.view', 'reports.run.create', 'reports.run.view_own', 'reports.artifact.download',
     'training.record.view', 'training.activity.view', 'training.compliance.view')
WHERE ps.code = 'PS_REPORT_TRAINING_RUNNER_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('report.module.view', 'reports.catalog.view', 'reports.run.create', 'reports.run.view_own', 'reports.artifact.download')
WHERE ps.code = 'PS_REPORT_RUNNER_NO_TRAINING_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'REPORT_TRAINING_RUNNER_DEV_TEST', 'Report Runner with Training (DEV test)',
       'DEV test: runs approved reports; sees training data of the own department only.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'REPORT_TRAINING_RUNNER_DEV_TEST');

INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'REPORT_RUNNER_NO_TRAINING_DEV_TEST', 'Report Runner without Training (DEV test)',
       'DEV test: runs approved reports; no training permission.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'REPORT_RUNNER_NO_TRAINING_DEV_TEST');

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_REPORT_TRAINING_RUNNER_DEV_TEST'
WHERE r.code = 'REPORT_TRAINING_RUNNER_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_REPORT_RUNNER_NO_TRAINING_DEV_TEST'
WHERE r.code = 'REPORT_RUNNER_NO_TRAINING_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'REPORT_TRAINING_RUNNER_DEV_TEST'
WHERE u.username IN ('uat31.head.qc', 'uat31.head.qa')
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'REPORT_RUNNER_NO_TRAINING_DEV_TEST'
WHERE u.username = 'dcv.u2'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);

COMMIT;
