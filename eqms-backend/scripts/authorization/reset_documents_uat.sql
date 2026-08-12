-- Documents authorization UAT reset.
--
-- RUN ONLY against the local Docker UAT database named eqms-database.
-- This script deliberately resets authorization configuration, but never deletes
-- Document Masters, Revisions, Controlled Copies, files, audit records, or users.
--
-- Run from D:\edms-project:
--   docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U eqms -d eqms-database < eqms-backend/scripts/authorization/reset_documents_uat.sql

BEGIN;

DO $$
BEGIN
    IF current_database() <> 'eqms-database' THEN
        RAISE EXCEPTION 'Refusing authorization reset outside local UAT database. Current database: %', current_database();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM app_users WHERE username IN ('admin', 'user.a.test', 'user.b.test', 'user.c.test', 'user.d.test', 'user.e.test', 'user.f.test', 'viewer.ops1')
    ) THEN
        RAISE EXCEPTION 'Required UAT accounts are missing. Run the approved test-user seed before this reset.';
    END IF;
END $$;

-- UAT accounts must be able to call authenticated endpoints immediately after login.
-- This does not change their password hashes or business identity data.
UPDATE app_users
SET must_change_password = false,
    password_changed_at = now(),
    failed_login_count = 0,
    locked_until = NULL,
    account_locked_at = NULL,
    account_lock_reason = NULL,
    updated_at = now()
WHERE username IN ('admin', 'user.a.test', 'user.b.test', 'user.c.test', 'user.d.test', 'user.e.test', 'user.f.test', 'viewer.ops1');

-- Remove the mixed legacy/test authorization layer. The catalog itself is retained
-- because non-Documents modules have not yet completed their own security review.
DELETE FROM access_profile_object_rules;
DELETE FROM access_profile_permission_sets;
DELETE FROM access_profile_workflow_roles;
DELETE FROM user_access_profiles;
DELETE FROM role_permissions;
DELETE FROM permission_set_items;
DELETE FROM permission_sets;
DELETE FROM object_access_rules;
DELETE FROM sod_constraints;
DELETE FROM roles;

-- Permission Sets: reusable action packages only. Object scope and workflow role
-- are intentionally assigned on the Access Profile, not embedded in these sets.
INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), v.name, v.code, v.description, true, true
FROM (VALUES
    ('UAT Document Reader', 'PS_UAT_DOCUMENT_READER', 'Preview published Documents in the Access Profile department scope.'),
    ('UAT Document Downloader', 'PS_UAT_DOCUMENT_DOWNLOADER', 'Optional published-document download capability; policy still controls availability.'),
    ('UAT Document Author', 'PS_UAT_DOCUMENT_AUTHOR', 'Author document metadata and Revision source content.'),
    ('UAT Document Co-Author', 'PS_UAT_DOCUMENT_COAUTHOR', 'Edit a Draft source online only; cannot upload or complete authoring.'),
    ('UAT Document Reviewer', 'PS_UAT_DOCUMENT_REVIEWER', 'Review or reject an assigned Revision.'),
    ('UAT Document Approver', 'PS_UAT_DOCUMENT_APPROVER', 'Approve or reject approval for an assigned Revision.'),
    ('UAT Document DCO', 'PS_UAT_DOCUMENT_DCO', 'DCO lifecycle, training, publishing, and Document Master administration actions.'),
    ('UAT Controlled Copy DCO', 'PS_UAT_CONTROLLED_COPY_DCO', 'DCO Controlled Copy Batch operations.'),
    ('UAT Document Security Admin', 'PS_UAT_DOCUMENT_SECURITY_ADMIN', 'Maintain Documents permission configuration and workflow roles.')
) AS v(name, code, description);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_UAT_DOCUMENT_READER', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_READER', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_READER', 'documents.document.preview_published'),

    ('PS_UAT_DOCUMENT_DOWNLOADER', 'documents.document.download_published'),

    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.document.create'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.document.edit_metadata'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.upload_source'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.edit_online'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.upload_office_online'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.complete_authoring'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.preview'),
    ('PS_UAT_DOCUMENT_AUTHOR', 'documents.revision.download_source'),

    ('PS_UAT_DOCUMENT_COAUTHOR', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_COAUTHOR', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_COAUTHOR', 'documents.revision.preview'),
    ('PS_UAT_DOCUMENT_COAUTHOR', 'documents.revision.edit_online'),

    ('PS_UAT_DOCUMENT_REVIEWER', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_REVIEWER', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_REVIEWER', 'documents.revision.preview'),
    ('PS_UAT_DOCUMENT_REVIEWER', 'documents.revision.review'),
    ('PS_UAT_DOCUMENT_REVIEWER', 'documents.revision.reject_review'),

    ('PS_UAT_DOCUMENT_APPROVER', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_APPROVER', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_APPROVER', 'documents.revision.preview'),
    ('PS_UAT_DOCUMENT_APPROVER', 'documents.revision.approve'),
    ('PS_UAT_DOCUMENT_APPROVER', 'documents.revision.reject_approval'),

    ('PS_UAT_DOCUMENT_DCO', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.create'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.edit_metadata'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.view_audit'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.cancel'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.document.obsolete'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.revision.submit_review'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.revision.complete_training'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.training.complete'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.revision.publish'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.revision.cancel'),
    ('PS_UAT_DOCUMENT_DCO', 'documents.revision.upgrade'),

    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.request'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.approve_request'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.distribute'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.recall'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.replace_lost_damaged'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.destroy'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.view_file'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.download_file'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.view_evidence'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'documents.controlled_copy.download_evidence'),

    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.permission_sets.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.permission_sets.update'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.access_profiles.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.access_profiles.update'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.access_profiles.assign'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.workflow_authorization.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.workflow_authorization.manage'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.object_rules.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.object_rules.manage'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.sod.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'security.sod.manage'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'documents.admin.view'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'documents.admin.manage_workflow_roles'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'documents.admin.manage_sod_constraints')
) AS v(permission_set_code, permission_code)
JOIN permission_sets ps ON ps.code = v.permission_set_code
JOIN permissions p ON p.code = v.permission_code;

-- Access Profiles carry scopes and workflow eligibility.
INSERT INTO roles (id, code, name, description, is_system, is_active, type, business_unit_scope, department_scope, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.name, v.description, v.is_system, true, v.type, v.business_unit_scope, v.department_scope, now(), now()
FROM (VALUES
    ('SYSTEM_SUPER_ADMIN', 'System Super Admin', 'UAT recovery account. This profile has global system access.', true, 'SYSTEM', 'ALL', 'ALL'),
    ('AP_UAT_DOCUMENT_SECURITY_ADMIN', 'UAT Document Security Admin', 'UAT security configuration administrator.', false, 'CUSTOM', 'ALL', 'QA'),
    ('AP_UAT_DCO_QUALITY', 'UAT DCO - Quality', 'Quality DCO for Documents and Controlled Copies.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_AUTHOR_QUALITY', 'UAT Author - Quality', 'Quality Document Author.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_COAUTHOR_QUALITY', 'UAT Co-Author - Quality', 'Quality Document Co-author.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_REVIEWER_QUALITY', 'UAT Reviewer - Quality', 'Quality Document Reviewer.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_APPROVER_QUALITY', 'UAT Approver - Quality', 'Quality Document Approver.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_READER_QUALITY', 'UAT Reader - Quality', 'Quality published-document reader.', false, 'CUSTOM', 'QAU', 'QA'),
    ('AP_UAT_READER_PRODUCTION', 'UAT Reader - Production', 'Production published-document reader.', false, 'CUSTOM', 'OPER', 'PROD')
) AS v(code, name, description, is_system, type, business_unit_scope, department_scope);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now()
FROM (VALUES
    ('AP_UAT_DOCUMENT_SECURITY_ADMIN', 'PS_UAT_DOCUMENT_SECURITY_ADMIN'),
    ('AP_UAT_DCO_QUALITY', 'PS_UAT_DOCUMENT_DCO'),
    ('AP_UAT_DCO_QUALITY', 'PS_UAT_CONTROLLED_COPY_DCO'),
    ('AP_UAT_AUTHOR_QUALITY', 'PS_UAT_DOCUMENT_AUTHOR'),
    ('AP_UAT_COAUTHOR_QUALITY', 'PS_UAT_DOCUMENT_COAUTHOR'),
    ('AP_UAT_REVIEWER_QUALITY', 'PS_UAT_DOCUMENT_REVIEWER'),
    ('AP_UAT_APPROVER_QUALITY', 'PS_UAT_DOCUMENT_APPROVER'),
    ('AP_UAT_READER_QUALITY', 'PS_UAT_DOCUMENT_READER'),
    ('AP_UAT_READER_PRODUCTION', 'PS_UAT_DOCUMENT_READER')
) AS v(access_profile_code, permission_set_code)
JOIN roles r ON r.code = v.access_profile_code
JOIN permission_sets ps ON ps.code = v.permission_set_code;

INSERT INTO access_profile_workflow_roles (access_profile_id, workflow_role, assigned_at)
SELECT r.id, v.workflow_role, now()
FROM (VALUES
    ('AP_UAT_DOCUMENT_SECURITY_ADMIN', 'QUALITY_ADMIN'),
    ('AP_UAT_DCO_QUALITY', 'DCO'),
    ('AP_UAT_AUTHOR_QUALITY', 'DOCUMENT_AUTHOR'),
    ('AP_UAT_REVIEWER_QUALITY', 'DOCUMENT_REVIEWER'),
    ('AP_UAT_APPROVER_QUALITY', 'DOCUMENT_APPROVER')
) AS v(access_profile_code, workflow_role)
JOIN roles r ON r.code = v.access_profile_code;

-- The approved SoD model blocks Author/Reviewer from simultaneously holding Approval.
INSERT INTO sod_constraints (id, name, description, permission_code_a, permission_code_b, severity, regulation_ref, active, system, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Document Submitter versus Approver', 'A user who can submit a Revision for review cannot also approve it.', 'documents.revision.submit_review', 'documents.revision.approve', 'BLOCK', 'EU-GMP Chapter 4; 21 CFR 211.68(b)', true, true, now(), now()),
    (gen_random_uuid(), 'Document Reviewer versus Approver', 'A Reviewer cannot also approve a Revision.', 'documents.revision.review', 'documents.revision.approve', 'BLOCK', 'EU GMP Annex 11 12.1', true, true, now(), now());

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM (VALUES
    ('admin', 'SYSTEM_SUPER_ADMIN'),
    ('admin', 'AP_UAT_DOCUMENT_SECURITY_ADMIN'),
    ('user.a.test', 'AP_UAT_DCO_QUALITY'),
    ('user.b.test', 'AP_UAT_AUTHOR_QUALITY'),
    ('user.c.test', 'AP_UAT_REVIEWER_QUALITY'),
    ('user.d.test', 'AP_UAT_COAUTHOR_QUALITY'),
    ('user.e.test', 'AP_UAT_READER_QUALITY'),
    ('user.f.test', 'AP_UAT_APPROVER_QUALITY'),
    ('viewer.ops1', 'AP_UAT_READER_PRODUCTION')
) AS v(username, access_profile_code)
JOIN app_users u ON u.username = v.username
JOIN roles r ON r.code = v.access_profile_code;

-- Remove residual role-name scope lookups from legacy roles for the UAT accounts.
UPDATE app_users u
SET role_name = v.access_profile_code,
    updated_at = now()
FROM (VALUES
    ('admin', 'SYSTEM_SUPER_ADMIN'),
    ('user.a.test', 'AP_UAT_DCO_QUALITY'),
    ('user.b.test', 'AP_UAT_AUTHOR_QUALITY'),
    ('user.c.test', 'AP_UAT_REVIEWER_QUALITY'),
    ('user.d.test', 'AP_UAT_COAUTHOR_QUALITY'),
    ('user.e.test', 'AP_UAT_READER_QUALITY'),
    ('user.f.test', 'AP_UAT_APPROVER_QUALITY'),
    ('viewer.ops1', 'AP_UAT_READER_PRODUCTION')
) AS v(username, access_profile_code)
WHERE u.username = v.username;

COMMIT;
