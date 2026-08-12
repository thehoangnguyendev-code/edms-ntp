-- Completes the UAT test-account matrix documented in
-- docs/EQMS_SECURITY_AUTHORIZATION_AND_DOCUMENTS_TEST_GUIDE.md.
--
-- Existing UAT infrastructure (from earlier migrations) already covers:
--   user.a.test -> AP_UAT_DCO_QUALITY
--   user.b.test -> AP_UAT_AUTHOR_QUALITY
--   user.c.test -> AP_UAT_REVIEWER_QUALITY
--   user.d.test -> AP_UAT_COAUTHOR_QUALITY
--   user.e.test -> AP_UAT_READER_QUALITY
--   user.f.test -> AP_UAT_APPROVER_QUALITY
--   AP_UAT_READER_PRODUCTION (access profile already exists, but had no user)
--
-- This migration only fills the remaining gaps:
--   1. A second Reviewer/Approver account (same access profile as the first —
--      a different person is intentionally NOT a participant on any revision,
--      used to prove "has the permission but is not the assigned participant"
--      negative tests).
--   2. A Viewer/Operator account in the Production department (reusing the
--      already-existing but previously unused AP_UAT_READER_PRODUCTION profile).
--   3. A Controlled Copy recipient account, plus its dedicated permission set
--      and access profile (none existed yet).
--
-- Per explicit instruction: there is no "Document Admin" role/profile anywhere
-- in this project's UAT set — DCO (AP_UAT_DCO_QUALITY) already carries every
-- document-administration permission a Document Admin would otherwise need.
--
-- Test login password for every user created below (same convention as the
-- other UAT/lifecycle-test seed users in this project): Test@12345

-- ── Permission Set: Controlled Copy Recipient ───────────────────────────────
INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'UAT Controlled Copy Recipient', 'PS_UAT_CONTROLLED_COPY_RECIPIENT',
       'View, preview, download an assigned controlled copy and report it lost/damaged. No request/approve/distribute/recall/destroy capability.',
       true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_UAT_CONTROLLED_COPY_RECIPIENT');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.module.view'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.view'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.view_file'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.download_file'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.report_lost_damaged'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.upload_evidence'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.view_evidence'),
    ('PS_UAT_CONTROLLED_COPY_RECIPIENT', 'documents.controlled_copy.download_evidence')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);

-- ── Access Profile: Controlled Copy Recipient (Quality) ─────────────────────
INSERT INTO roles (id, code, name, description, is_system, is_active, business_unit_scope, department_scope, type)
SELECT gen_random_uuid(), 'AP_UAT_CC_RECIPIENT_QUALITY', 'UAT Controlled Copy Recipient - Quality',
       'UAT only. Views/downloads controlled copies assigned as recipient and may report them lost/damaged. No distribution/recall/destroy rights.',
       false, true, 'QAU', 'QA', 'CUSTOM'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'AP_UAT_CC_RECIPIENT_QUALITY');

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r, permission_sets ps
WHERE r.code = 'AP_UAT_CC_RECIPIENT_QUALITY' AND ps.code = 'PS_UAT_CONTROLLED_COPY_RECIPIENT'
AND NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets a
    WHERE a.access_profile_id = r.id AND a.permission_set_id = ps.id
);

-- ── Users ────────────────────────────────────────────────────────────────
-- user.g.test: second Reviewer, same AP_UAT_REVIEWER_QUALITY profile as user.c.test.
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, business_unit, status, created_at, updated_at, employee_code)
SELECT gen_random_uuid(), 'user.g.test', 'user.g.test@example.local', 'UAT Reviewer 2 (Not Assigned)',
       '$2a$10$4QXxF/v6Q5NuI28aG.qSgOQeqBLukluefJ9Fn4AZmWK4kxypQeH7.', 'AP_UAT_REVIEWER_QUALITY',
       'Quality', 'Quality', 'Active', now(), now(), 'TEST-USER-G'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'user.g.test');

-- user.h.test: second Approver, same AP_UAT_APPROVER_QUALITY profile as user.f.test.
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, business_unit, status, created_at, updated_at, employee_code)
SELECT gen_random_uuid(), 'user.h.test', 'user.h.test@example.local', 'UAT Approver 2 (Not Assigned)',
       '$2a$10$4QXxF/v6Q5NuI28aG.qSgOQeqBLukluefJ9Fn4AZmWK4kxypQeH7.', 'AP_UAT_APPROVER_QUALITY',
       'Quality', 'Quality', 'Active', now(), now(), 'TEST-USER-H'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'user.h.test');

-- user.i.test: Viewer in Production (negative department-scope test), reuses existing AP_UAT_READER_PRODUCTION.
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, business_unit, status, created_at, updated_at, employee_code)
SELECT gen_random_uuid(), 'user.i.test', 'user.i.test@example.local', 'UAT Viewer - Production',
       '$2a$10$4QXxF/v6Q5NuI28aG.qSgOQeqBLukluefJ9Fn4AZmWK4kxypQeH7.', 'AP_UAT_READER_PRODUCTION',
       'Production', 'Operations', 'Active', now(), now(), 'TEST-USER-I'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'user.i.test');

-- user.j.test: Controlled Copy recipient.
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, business_unit, status, created_at, updated_at, employee_code)
SELECT gen_random_uuid(), 'user.j.test', 'user.j.test@example.local', 'UAT Controlled Copy Recipient',
       '$2a$10$4QXxF/v6Q5NuI28aG.qSgOQeqBLukluefJ9Fn4AZmWK4kxypQeH7.', 'AP_UAT_CC_RECIPIENT_QUALITY',
       'Quality', 'Quality', 'Active', now(), now(), 'TEST-USER-J'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'user.j.test');

-- ── Assign access profiles ───────────────────────────────────────────────
INSERT INTO user_access_profiles (user_id, access_profile_id)
SELECT u.id, r.id
FROM (VALUES
    ('user.g.test', 'AP_UAT_REVIEWER_QUALITY'),
    ('user.h.test', 'AP_UAT_APPROVER_QUALITY'),
    ('user.i.test', 'AP_UAT_READER_PRODUCTION'),
    ('user.j.test', 'AP_UAT_CC_RECIPIENT_QUALITY')
) AS v(username, profile_code)
JOIN app_users u ON u.username = v.username
JOIN roles r ON r.code = v.profile_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_access_profiles uap
    WHERE uap.user_id = u.id AND uap.access_profile_id = r.id
);
