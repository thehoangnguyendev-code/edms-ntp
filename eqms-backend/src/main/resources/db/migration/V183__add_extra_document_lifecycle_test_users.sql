-- Enabling same_user_cannot_hold_multiple_workflow_roles / author_co_author_cannot_be_
-- reviewer_or_approver (V182) means a single document now needs 4 genuinely distinct
-- people for Author/Co-Author/Reviewer/Approver. B/C/D from V179 each hold two Access
-- Profiles (useful for testing role-switching *across* documents) but that leaves no
-- clean 4th person for a *single* document's Approver slot. Add two single-purpose
-- accounts so every document can be fully staffed without any overlap.
-- Password (same as the other 4 test users): Test@12345

INSERT INTO app_users (
    id, username, email, full_name, password_hash, role_name, department, position,
    status, must_change_password, mfa_enabled, failed_login_count, created_at, updated_at,
    employee_code, business_unit
)
SELECT gen_random_uuid(), v.username, v.email, v.full_name,
       '$2a$10$ezgXSfDDqj3LTLqdoswuO.kBv1cqrqZ4kEwItIZ2dMjfbcoKV.7JG',
       v.role_name, 'Quality', 'QA Specialist', 'Active', false, false, 0, now(), now(),
       v.employee_code, 'Quality'
FROM (VALUES
    ('user.e.test', 'user.e.test@example.local', 'User E (Reviewer Only Test)', 'Reviewer', 'TEST-USER-E'),
    ('user.f.test', 'user.f.test@example.local', 'User F (Approver Only Test)', 'Approver', 'TEST-USER-F')
) AS v(username, email, full_name, role_name, employee_code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN (VALUES
    ('user.e.test', 'REVIEWER_TEST'),
    ('user.f.test', 'APPROVER_TEST')
) AS v(username, role_code) ON v.username = u.username
JOIN roles r ON r.code = v.role_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id AND uap.access_profile_id = r.id
);
