-- Legacy Batch Import lets a user create a document's ENTIRE historical revision chain
-- (e.g. 1.0 -> 4.0) in one shot instead of only the single first revision that
-- documents.legacy_import.manage allows. Kept as its OWN, separate permission (not folded into
-- documents.legacy_import.manage) for Segregation of Duties: a mistake in a batch operation has a
-- much larger blast radius (fabricated history across many revisions at once) than a single-revision
-- import, so an Access Profile should be able to grant one without the other going forward.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'documents.legacy_import.batch', 'Legacy Batch Import (Multiple Revisions)',
        'Document Administration', 'documents', 'document_administration',
        'Import a document''s entire historical revision chain (e.g. 1.0 through 4.0) as a paper archive migration, in a single batch operation.',
        54, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Backfill: every Permission Set that already holds documents.legacy_import.manage also receives
-- the new batch permission, so existing Legacy Import operators are not blocked on day one. An
-- Admin can later revoke the batch permission independently per the SoD note above.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'documents.legacy_import.manage'
) src
JOIN permissions tgt ON tgt.code = 'documents.legacy_import.batch'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
