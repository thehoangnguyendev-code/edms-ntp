-- Testing enablement: per user request, every account other than the existing full-access
-- Controlled Copy tester (AP_UAT_DCO_QUALITY, already has all 15 documents.controlled_copy.*
-- permissions) should be able to REQUEST a controlled copy. Visibility is still governed by
-- existing document/revision access scoping (documents.document.view / documents.revision.view
-- etc.) — a user can only request a controlled copy for a document/revision they can already
-- see, unchanged by this migration.
--
-- NOT granted to SYSTEM_SUPER_ADMIN or AP_UAT_DOCUMENT_SECURITY_ADMIN (the admin account's
-- profiles) — per the earlier GMP Segregation of Duties change (V243), SuperAdmin intentionally
-- has no operational document permissions; adding it to a secondary profile the admin account
-- also holds would silently re-open that gap.

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'UAT Controlled Copy Requester', 'PS_UAT_CONTROLLED_COPY_REQUESTER',
       'Testing enablement: request, view, and cancel own controlled copy requests. Visibility of which documents/revisions can be requested is still governed by normal document access scoping.',
       true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_UAT_CONTROLLED_COPY_REQUESTER');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_UAT_CONTROLLED_COPY_REQUESTER', 'documents.controlled_copy.request'),
    ('PS_UAT_CONTROLLED_COPY_REQUESTER', 'documents.controlled_copy.view'),
    ('PS_UAT_CONTROLLED_COPY_REQUESTER', 'documents.controlled_copy.cancel_request')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r, permission_sets ps
WHERE ps.code = 'PS_UAT_CONTROLLED_COPY_REQUESTER'
AND r.code IN (
    'APPROVER_LEAD', 'DCO', 'DOCUMENT_CONTROLLER', 'REVIEWER_LEAD', 'SUPERVISOR', 'QUALITY',
    'ADMINISTRATOR', 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY', 'AP_UAT_READER_QUALITY',
    'AP_UAT_READER_PRODUCTION', 'AP_UAT_CC_RECIPIENT_QUALITY', 'VIEWER_OPERATOR', 'DOCUMENT_TRAINEE'
)
AND NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets a
    WHERE a.access_profile_id = r.id AND a.permission_set_id = ps.id
);
