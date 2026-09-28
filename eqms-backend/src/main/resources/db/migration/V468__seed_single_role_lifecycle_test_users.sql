-- Seed 7 dedicated, single-Access-Profile test users for full end-to-end lifecycle
-- testing (DCO, Author, 2x Co-Author, 2x Reviewer, Approver) — reuses the Permission
-- Sets/Access Profiles already seeded by V179 (PS_DCO_TEST/DCO_TEST etc.), just gives
-- each role its own dedicated account instead of V179's multi-role user.a/b/c/d, so
-- role-specific behavior (e.g. two Reviewers for a non-parallel sequence test, two
-- Co-Authors for a real-time co-editing test) can be exercised independently.
-- Password for all 7: Test@12345 (same BCrypt hash/cost as V179 and the app's
-- PasswordEncoder). must_change_password=false so they can log in immediately.
-- mfa_email_fallback_enabled explicitly false: the default (true) has previously
-- caused unwanted MFA email-fallback prompts on freshly-created test accounts.

INSERT INTO app_users (
    id, username, email, full_name, password_hash, role_name, department, position,
    status, must_change_password, mfa_enabled, mfa_email_fallback_enabled, failed_login_count,
    created_at, updated_at, employee_code, business_unit
)
SELECT gen_random_uuid(), v.username, v.email, v.full_name,
       '$2a$10$ezgXSfDDqj3LTLqdoswuO.kBv1cqrqZ4kEwItIZ2dMjfbcoKV.7JG',
       v.role_name, 'Quality', 'QA Specialist', 'Active', false, false, false, 0, now(), now(),
       v.employee_code, 'Quality'
FROM (VALUES
    ('dco.test1',       'dco.test1@example.local',       'DCO Test 1',       'DCO',       'TEST-DCO-01'),
    ('author.test1',    'author.test1@example.local',    'Author Test 1',    'Author',    'TEST-AUTH-01'),
    ('coauthor.test1',  'coauthor.test1@example.local',  'Co-Author Test 1', 'Co-Author', 'TEST-COAU-01'),
    ('coauthor.test2',  'coauthor.test2@example.local',  'Co-Author Test 2', 'Co-Author', 'TEST-COAU-02'),
    ('reviewer.test1',  'reviewer.test1@example.local',  'Reviewer Test 1',  'Reviewer',  'TEST-REV-01'),
    ('reviewer.test2',  'reviewer.test2@example.local',  'Reviewer Test 2',  'Reviewer',  'TEST-REV-02'),
    ('approver.test1',  'approver.test1@example.local',  'Approver Test 1',  'Approver',  'TEST-APPR-01')
) AS v(username, email, full_name, role_name, employee_code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN (VALUES
    ('dco.test1', 'DCO_TEST'),
    ('author.test1', 'AUTHOR_TEST'),
    ('coauthor.test1', 'COAUTHOR_TEST'),
    ('coauthor.test2', 'COAUTHOR_TEST'),
    ('reviewer.test1', 'REVIEWER_TEST'),
    ('reviewer.test2', 'REVIEWER_TEST'),
    ('approver.test1', 'APPROVER_TEST')
) AS v(username, role_code) ON v.username = u.username
JOIN roles r ON r.code = v.role_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id AND uap.access_profile_id = r.id
);
