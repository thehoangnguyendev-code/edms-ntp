-- Consolidates the narrow per-workflow-role UAT permission sets (Author,
-- Co-Author, Reviewer, Approver) into one broad "Document Contributor"
-- permission set + access profile, per design discussion in
-- docs/EQMS_SECURITY_AUTHORIZATION_AND_DOCUMENTS_TEST_GUIDE.md.
--
-- Rationale: the real per-document boundary is already the participant
-- roster (RevisionWorkflowParticipant / DocumentWorkflowParticipant) checked
-- by RevisionService.requirePendingParticipant(...) and
-- DocumentAuthorizationService — NOT which narrow permission set a user
-- happens to hold. Narrow per-role permission sets only add a silent
-- provisioning failure mode (Admin forgets to tick one permission -> user
-- can never be picked for that role anywhere). Widening to one Contributor
-- set removes that failure mode without weakening SoD, since SoD
-- (author != reviewer != approver on the same document) is enforced at
-- participant-assignment time, independent of the user's permission set.
--
-- DCO-exclusive actions (create/edit_metadata/manage_relations/cancel/
-- obsolete/submit_review/publish/complete_training + all Controlled Copy
-- lifecycle) stay untouched in the existing PS_UAT_DOCUMENT_DCO set.

-- ── Permission Set: Document Contributor ────────────────────────────────────
INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'UAT Document Contributor', 'PS_UAT_DOCUMENT_CONTRIBUTOR',
       'Broad Author + Co-Author + Reviewer + Approver capability for Document Control. Excludes all DCO-exclusive actions (create/edit metadata/cancel/obsolete/submit/publish/controlled copy lifecycle) which remain in PS_UAT_DOCUMENT_DCO.',
       true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_UAT_DOCUMENT_CONTRIBUTOR');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.module.view'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.document.view'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.upload_source'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.complete_authoring'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.review'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.reject_review'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.approve'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.reject_approval'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.preview'),
    ('PS_UAT_DOCUMENT_CONTRIBUTOR', 'documents.revision.download_source')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);

-- ── Access Profile: Document Contributor (Quality) ──────────────────────────
INSERT INTO roles (id, code, name, description, is_system, is_active, business_unit_scope, department_scope, type)
SELECT gen_random_uuid(), 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY', 'UAT Document Contributor - Quality',
       'UAT only. Broad Author/Co-Author/Reviewer/Approver capability. Actual role on a given document is determined by DCO participant assignment, not by this profile.',
       false, true, 'QAU', 'QA', 'CUSTOM'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY');

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r, permission_sets ps
WHERE r.code = 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY' AND ps.code = 'PS_UAT_DOCUMENT_CONTRIBUTOR'
AND NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets a
    WHERE a.access_profile_id = r.id AND a.permission_set_id = ps.id
);

-- Required so DocumentService.requirePoolMembership does not block assigning
-- this profile's users as Reviewer/Approver participants at Document-draft
-- level (it checks access_profile_workflow_roles for DOCUMENT_REVIEWER /
-- DOCUMENT_APPROVER, or legacy pool membership).
INSERT INTO access_profile_workflow_roles (access_profile_id, workflow_role)
SELECT r.id, wr.code
FROM roles r, workflow_roles wr
WHERE r.code = 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY'
AND wr.code IN ('DOCUMENT_AUTHOR', 'DOCUMENT_REVIEWER', 'DOCUMENT_APPROVER')
AND NOT EXISTS (
    SELECT 1 FROM access_profile_workflow_roles a
    WHERE a.access_profile_id = r.id AND a.workflow_role = wr.code
);

-- ── Re-point the 6 contributor-type test users onto the consolidated profile ─
DELETE FROM user_access_profiles
WHERE access_profile_id IN (
    SELECT id FROM roles WHERE code IN (
        'AP_UAT_AUTHOR_QUALITY', 'AP_UAT_REVIEWER_QUALITY',
        'AP_UAT_COAUTHOR_QUALITY', 'AP_UAT_APPROVER_QUALITY'
    )
)
AND user_id IN (
    SELECT id FROM app_users
    WHERE username IN ('user.b.test', 'user.c.test', 'user.d.test', 'user.f.test', 'user.g.test', 'user.h.test')
);

INSERT INTO user_access_profiles (user_id, access_profile_id)
SELECT u.id, r.id
FROM app_users u, roles r
WHERE u.username IN ('user.b.test', 'user.c.test', 'user.d.test', 'user.f.test', 'user.g.test', 'user.h.test')
AND r.code = 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY'
AND NOT EXISTS (
    SELECT 1 FROM user_access_profiles a
    WHERE a.user_id = u.id AND a.access_profile_id = r.id
);
