-- PS_DCO_TEST was seeded (V179) before several permissions used by the real DCO workflow
-- existed, or was seeded incompletely -- each missing code has been surfacing one at a time as
-- "Access Denied"/"cannot configure..." errors while testing the full lifecycle
-- (Create -> Draft -> Review -> Approval -> Training -> Publish -> Upgrade -> Controlled Copy).
-- Rather than keep patching one permission per bug report, bring PS_DCO_TEST fully in line with
-- the real production PS_DOCUMENT_DCO role in one pass -- every permission listed below is one
-- PS_DOCUMENT_DCO already has that PS_DCO_TEST was still missing as of V472.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'documents.document.configure_initial_workflow'),
    ('PS_DCO_TEST', 'documents.controlled_copy.request'),
    ('PS_DCO_TEST', 'documents.document.preview_published'),
    ('PS_DCO_TEST', 'documents.document.view_audit'),
    ('PS_DCO_TEST', 'documents.revision.configure_next_approvers'),
    ('PS_DCO_TEST', 'documents.revision.configure_next_correlated_documents'),
    ('PS_DCO_TEST', 'documents.revision.configure_next_related_documents'),
    ('PS_DCO_TEST', 'documents.revision.configure_next_reviewers'),
    ('PS_DCO_TEST', 'documents.revision.obsolete'),
    ('PS_DCO_TEST', 'documents.revision.update_draft_metadata'),
    ('PS_DCO_TEST', 'documents.template.use'),
    ('PS_DCO_TEST', 'documents.training.complete'),
    ('PS_DCO_TEST', 'documents.workspace.manage'),
    ('PS_DCO_TEST', 'self_service.knowledge.view')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
