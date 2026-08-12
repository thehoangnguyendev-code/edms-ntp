-- Seed 5 test Access Profiles (Permission Set + Role + Workflow Role where
-- applicable) and 4 test users for exercising the Document Control lifecycle
-- (Draft -> Effective -> Obsolete) end-to-end, per docs/DOCUMENT_LIFECYCLE_TEST_GUIDE.md.
-- All rows are plain CUSTOM/non-system records — fully editable/deletable
-- afterwards like any manually-created role or user, nothing hardcoded.
-- Test login password for all 4 users: Test@12345

-- ── Permission Sets ──────────────────────────────────────────────────────────

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), v.name, v.code, v.description, true, false
FROM (VALUES
    ('DCO Test', 'PS_DCO_TEST', 'Document Control coordinator capabilities for lifecycle testing.'),
    ('Author Test', 'PS_AUTHOR_TEST', 'Document revision authoring capabilities for lifecycle testing.'),
    ('Co-Author Test', 'PS_COAUTHOR_TEST', 'Co-author edit-online-only capabilities for lifecycle testing.'),
    ('Reviewer Test', 'PS_REVIEWER_TEST', 'Document review capabilities for lifecycle testing.'),
    ('Approver Test', 'PS_APPROVER_TEST', 'Document approval capabilities for lifecycle testing.')
) AS v(name, code, description)
WHERE NOT EXISTS (SELECT 1 FROM permission_sets ps WHERE ps.code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'documents.module.view'),
    ('PS_DCO_TEST', 'documents.document.view'),
    ('PS_DCO_TEST', 'documents.document.create'),
    ('PS_DCO_TEST', 'documents.document.edit_metadata'),
    ('PS_DCO_TEST', 'documents.document.manage_relations'),
    ('PS_DCO_TEST', 'documents.revision.edit_metadata'),
    ('PS_DCO_TEST', 'documents.revision.submit_review'),
    ('PS_DCO_TEST', 'documents.revision.generate_preview'),
    ('PS_DCO_TEST', 'documents.revision.open_publishing_workspace'),
    ('PS_DCO_TEST', 'documents.revision.preview'),
    ('PS_DCO_TEST', 'documents.revision.publish'),
    ('PS_DCO_TEST', 'documents.revision.cancel'),
    ('PS_DCO_TEST', 'documents.revision.upgrade'),
    ('PS_DCO_TEST', 'documents.revision.complete_training'),
    ('PS_DCO_TEST', 'documents.document.cancel'),
    ('PS_DCO_TEST', 'documents.document.obsolete'),

    ('PS_AUTHOR_TEST', 'documents.module.view'),
    ('PS_AUTHOR_TEST', 'documents.document.view'),
    ('PS_AUTHOR_TEST', 'documents.revision.upload_source'),
    ('PS_AUTHOR_TEST', 'documents.revision.edit_online'),
    ('PS_AUTHOR_TEST', 'documents.revision.complete_authoring'),
    ('PS_AUTHOR_TEST', 'documents.revision.preview'),
    ('PS_AUTHOR_TEST', 'documents.revision.download_source'),
    ('PS_AUTHOR_TEST', 'documents.office_online.upload'),
    ('PS_AUTHOR_TEST', 'documents.office_online.edit'),

    ('PS_COAUTHOR_TEST', 'documents.module.view'),
    ('PS_COAUTHOR_TEST', 'documents.document.view'),
    ('PS_COAUTHOR_TEST', 'documents.revision.preview'),
    ('PS_COAUTHOR_TEST', 'documents.revision.edit_online'),

    ('PS_REVIEWER_TEST', 'documents.module.view'),
    ('PS_REVIEWER_TEST', 'documents.document.view'),
    ('PS_REVIEWER_TEST', 'documents.revision.preview'),
    ('PS_REVIEWER_TEST', 'documents.revision.review'),
    ('PS_REVIEWER_TEST', 'documents.revision.reject_review'),

    ('PS_APPROVER_TEST', 'documents.module.view'),
    ('PS_APPROVER_TEST', 'documents.document.view'),
    ('PS_APPROVER_TEST', 'documents.revision.preview'),
    ('PS_APPROVER_TEST', 'documents.revision.approve'),
    ('PS_APPROVER_TEST', 'documents.revision.reject_approval')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);

-- ── Access Profiles (Roles) ──────────────────────────────────────────────────

INSERT INTO roles (id, code, name, description, is_system, is_active, created_at, updated_at, type)
SELECT gen_random_uuid(), v.code, v.name, v.description, false, true, now(), now(), 'CUSTOM'
FROM (VALUES
    ('DCO_TEST', 'DCO Test', 'Document Control coordinator role for lifecycle testing.'),
    ('AUTHOR_TEST', 'Author Test', 'Document author role for lifecycle testing.'),
    ('COAUTHOR_TEST', 'Co-Author Test', 'Document co-author role for lifecycle testing.'),
    ('REVIEWER_TEST', 'Reviewer Test', 'Document reviewer role for lifecycle testing.'),
    ('APPROVER_TEST', 'Approver Test', 'Document approver role for lifecycle testing.')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.code = v.code);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now()
FROM roles r
JOIN (VALUES
    ('DCO_TEST', 'PS_DCO_TEST'),
    ('AUTHOR_TEST', 'PS_AUTHOR_TEST'),
    ('COAUTHOR_TEST', 'PS_COAUTHOR_TEST'),
    ('REVIEWER_TEST', 'PS_REVIEWER_TEST'),
    ('APPROVER_TEST', 'PS_APPROVER_TEST')
) AS v(role_code, ps_code) ON v.role_code = r.code
JOIN permission_sets ps ON ps.code = v.ps_code
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets aps
    WHERE aps.access_profile_id = r.id AND aps.permission_set_id = ps.id
);

INSERT INTO access_profile_workflow_roles (access_profile_id, workflow_role, assigned_at)
SELECT r.id, v.workflow_role, now()
FROM roles r
JOIN (VALUES
    ('DCO_TEST', 'DCO'),
    ('REVIEWER_TEST', 'DOCUMENT_REVIEWER'),
    ('APPROVER_TEST', 'DOCUMENT_APPROVER')
) AS v(role_code, workflow_role) ON v.role_code = r.code
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_workflow_roles awr
    WHERE awr.access_profile_id = r.id AND awr.workflow_role = v.workflow_role
);

-- ── Test users ────────────────────────────────────────────────────────────
-- Password for all 4: Test@12345 (BCrypt hash below, strength 10 — same
-- algorithm/cost as the app's PasswordEncoder). must_change_password=false
-- so they can log in immediately for testing.

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
    ('user.a.test', 'user.a.test@example.local', 'User A (DCO Test)', 'DCO', 'TEST-USER-A'),
    ('user.b.test', 'user.b.test@example.local', 'User B (Author/Reviewer Test)', 'Author', 'TEST-USER-B'),
    ('user.c.test', 'user.c.test@example.local', 'User C (Reviewer/Approver Test)', 'Reviewer', 'TEST-USER-C'),
    ('user.d.test', 'user.d.test@example.local', 'User D (Co-Author/Approver Test)', 'Co-Author', 'TEST-USER-D')
) AS v(username, email, full_name, role_name, employee_code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);

-- ── Assign Access Profiles to test users (per the cross-document role matrix) ──

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN (VALUES
    ('user.a.test', 'DCO_TEST'),
    ('user.b.test', 'AUTHOR_TEST'),
    ('user.b.test', 'REVIEWER_TEST'),
    ('user.c.test', 'REVIEWER_TEST'),
    ('user.c.test', 'APPROVER_TEST'),
    ('user.d.test', 'COAUTHOR_TEST'),
    ('user.d.test', 'APPROVER_TEST')
) AS v(username, role_code) ON v.username = u.username
JOIN roles r ON r.code = v.role_code
WHERE NOT EXISTS (
    SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id AND uap.access_profile_id = r.id
);
