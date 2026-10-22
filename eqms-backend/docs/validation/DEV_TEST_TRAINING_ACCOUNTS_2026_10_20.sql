-- DEV test only (2026-10-20, owner instruction in the session): three further test accounts for Training Management, with their own permission sets and access profiles, so that the screens
-- can be tried by people who hold only the permissions of their duty (a trainee, a trainer) and not the broad test set of admin. Idempotent; DEV data only, never run on another environment.
-- The accounts take the password hash of the admin test account (the shared DEV test password). Restart the backend afterwards: permissions are cached.
BEGIN;

INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Training Trainee (DEV test)', 'PS_TRAINING_TRAINEE_DEV_TEST', 'DEV test: an employee who is trained: sees My Training and signs for own training.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_TRAINING_TRAINEE_DEV_TEST');
INSERT INTO permission_sets (id, name, code, description, active, system, created_at, updated_at, version)
SELECT gen_random_uuid(), 'Training Trainer (DEV test)', 'PS_TRAINING_TRAINER_DEV_TEST', 'DEV test: a trainer: conducts sessions, records attendance and assessments, prints paper packs and types results from paper.', TRUE, FALSE, now(), now(), 0
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_TRAINING_TRAINER_DEV_TEST');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('training.module.view', 'training.self.view')
WHERE ps.code = 'PS_TRAINING_TRAINEE_DEV_TEST' AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id FROM permission_sets ps JOIN permissions p ON p.code IN ('training.module.view', 'training.self.view', 'training.activity.view', 'training.activity.conduct',
     'training.assessment.record', 'training.paper.print', 'training.paper.transcribe', 'training.record.view')
WHERE ps.code = 'PS_TRAINING_TRAINER_DEV_TEST' AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);

INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'TRAINING_TRAINEE_DEV_TEST', 'Training Trainee (DEV test)', 'DEV test: trainee of Training Management.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'TRAINING_TRAINEE_DEV_TEST');
INSERT INTO roles (id, code, name, description, is_system, is_active, type, version, created_at, updated_at)
SELECT gen_random_uuid(), 'TRAINING_TRAINER_DEV_TEST', 'Training Trainer (DEV test)', 'DEV test: trainer of Training Management.', FALSE, TRUE, 'CUSTOM', 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'TRAINING_TRAINER_DEV_TEST');

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_TRAINING_TRAINEE_DEV_TEST' WHERE r.code = 'TRAINING_TRAINEE_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now() FROM roles r JOIN permission_sets ps ON ps.code = 'PS_TRAINING_TRAINER_DEV_TEST' WHERE r.code = 'TRAINING_TRAINER_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = r.id AND x.permission_set_id = ps.id);

INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), v.username, v.username || '@example.local', v.full_name, (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       'Quality Assurance', 'QA Specialist', 'Active', v.code, 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
FROM (VALUES ('trainee.test1', 'Trainee Test 1', 'TEST-TRN-01'), ('trainee.test2', 'Trainee Test 2', 'TEST-TRN-02'), ('trainer.test1', 'Trainer Test 1', 'TEST-TRN-03')) AS v(username, full_name, code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

-- Like the other DEV test accounts: no second factor by e-mail, so that the walkthrough scripts can sign in.
UPDATE app_users SET mfa_email_fallback_enabled = FALSE, mfa_remember_device_enabled = FALSE, password_changed_at = COALESCE(password_changed_at, now()) WHERE username IN ('trainee.test1', 'trainee.test2', 'trainer.test1');

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'TRAINING_TRAINEE_DEV_TEST' WHERE u.username IN ('trainee.test1', 'trainee.test2')
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON r.code = 'TRAINING_TRAINER_DEV_TEST' WHERE u.username = 'trainer.test1'
  AND NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
COMMIT;
