-- Grant Audit Trail viewing to all 5 lifecycle-test Access Profiles (DCO, Author, Co-Author,
-- Reviewer, Approver): audittrail.module.view (the global Audit Trail nav item/screen) and
-- documents.document.view_audit (the Audit Trail tab on a Document/Revision detail view).

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'audittrail.module.view'),
    ('PS_DCO_TEST', 'documents.document.view_audit'),
    ('PS_AUTHOR_TEST', 'audittrail.module.view'),
    ('PS_AUTHOR_TEST', 'documents.document.view_audit'),
    ('PS_COAUTHOR_TEST', 'audittrail.module.view'),
    ('PS_COAUTHOR_TEST', 'documents.document.view_audit'),
    ('PS_REVIEWER_TEST', 'audittrail.module.view'),
    ('PS_REVIEWER_TEST', 'documents.document.view_audit'),
    ('PS_APPROVER_TEST', 'audittrail.module.view'),
    ('PS_APPROVER_TEST', 'documents.document.view_audit')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
