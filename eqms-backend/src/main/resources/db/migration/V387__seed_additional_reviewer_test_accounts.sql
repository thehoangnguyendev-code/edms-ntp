-- Add 3 more Reviewer-only test accounts (on top of user.e.test) so the
-- Sub-Type-driven reviewer cap/floor (SINGLE / MULTIPLE / FLEXIBLE) can
-- actually be exercised in the picker modal -- one reviewer alone can't
-- test "pick 2+" or "hit the cap at 1 and try to add a 2nd" scenarios.
-- Password (same as the other test users): Test@12345

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
    ('user.k.test', 'user.k.test@example.local', 'User K (Reviewer Only Test 2)', 'Reviewer', 'TEST-USER-K'),
    ('user.l.test', 'user.l.test@example.local', 'User L (Reviewer Only Test 3)', 'Reviewer', 'TEST-USER-L'),
    ('user.m.test', 'user.m.test@example.local', 'User M (Reviewer Only Test 4)', 'Reviewer', 'TEST-USER-M')
) AS v(username, email, full_name, role_name, employee_code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN (VALUES
    ('user.k.test', 'REVIEWER_TEST'),
    ('user.l.test', 'REVIEWER_TEST'),
    ('user.m.test', 'REVIEWER_TEST')
) AS v(username, role_code) ON v.username = u.username
JOIN roles r ON r.code = v.role_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id AND uap.access_profile_id = r.id
);
