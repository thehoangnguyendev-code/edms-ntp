-- DEV test only (2026-10-16, TRAINING phase A): the Report Author test permission set also holds every training.* permission so that the test account admin
-- can use Training Management on DEV. Idempotent. Restart the backend afterwards: permissions are cached.
BEGIN;
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code LIKE 'training.%'
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
COMMIT;

-- DEV test only: the second test account approver.test1 (profile used by that account alone) gets the same test set, so that two different people can
-- prepare and approve in the tests (segregation of duties). Restart the backend afterwards.
BEGIN;
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT '428c4ebf-f01c-4a86-bf0f-6d0a706ea56d', ps.id FROM permission_sets ps
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = '428c4ebf-f01c-4a86-bf0f-6d0a706ea56d' AND x.permission_set_id = ps.id);
COMMIT;

-- DEV test only: a third account for the tests that need three different people (prepare, review, approve). user.a.test takes the training test set (profile
-- used by that account alone) and the same login as the admin test account. DEV data only; never run on another environment.
BEGIN;
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT 'a6f3de00-2b33-44d6-8dbc-d280eee3062a', ps.id FROM permission_sets ps
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets x WHERE x.access_profile_id = 'a6f3de00-2b33-44d6-8dbc-d280eee3062a' AND x.permission_set_id = ps.id);
UPDATE app_users SET password_hash = (SELECT password_hash FROM app_users WHERE username = 'admin') WHERE username = 'user.a.test';
COMMIT;

-- DEV test only: training records for the admin test account on the topics that the API test scripts use, so that admin is a qualified trainer there (TR-19).
-- Records are inserted the same way the system writes them; nothing here is a real person's training. Idempotent.
BEGIN;
INSERT INTO training_records (id, person_user_id, activity_id, training_number, topic_text, completed_on, method, result, employee_code, full_name, department, position, content_sha256)
SELECT gen_random_uuid(), u.id, (SELECT id FROM training_activities WHERE status = 'COMPLETED' ORDER BY created_at LIMIT 1), 'TRN/DEV/00-000', t.topic, current_date - 30, 'CLASSROOM', 'PASSED',
       u.employee_code, u.full_name, u.department, u.position, md5(t.topic || u.id::text) || md5(u.id::text || t.topic)
FROM app_users u
CROSS JOIN (VALUES ('GMP basics'), ('GMP basics (test)'), ('SOP read'), ('Read the new SOP'), ('Gowning'), ('Self reading')) AS t(topic)
WHERE u.username = 'admin'
  AND EXISTS (SELECT 1 FROM training_activities WHERE status = 'COMPLETED')
  AND NOT EXISTS (SELECT 1 FROM training_records r WHERE r.person_user_id = u.id AND r.topic_text = t.topic AND r.training_number = 'TRN/DEV/00-000');
COMMIT;
