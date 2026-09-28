-- "Next Step"/Save on the document-creation metadata step is gated by
-- documents.document.update_metadata specifically (a distinct permission from
-- documents.document.edit_metadata, which PS_DCO_TEST already had) -- every real production
-- DCO-shaped role (ROLE_DCO, ROLE_DOCUMENT_CONTROLLER, PS_DOCUMENT_DCO) bundles both
-- update_metadata and configure_next_metadata alongside create/edit_metadata, confirming this
-- was simply missing from the test seed rather than an intentional restriction: a DCO who can
-- create a document must be able to save the metadata they just entered.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'documents.document.update_metadata'),
    ('PS_DCO_TEST', 'documents.document.configure_next_metadata')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
