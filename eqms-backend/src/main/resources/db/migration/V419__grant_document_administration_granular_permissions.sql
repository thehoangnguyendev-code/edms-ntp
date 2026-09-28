-- Preserve current access: every Permission Set that today grants documents.admin.view also
-- receives all 6 new *.view codes; every set granting documents.admin.manage also receives all
-- 6 new *.manage codes. This guarantees zero regression -- nobody loses access to any Document
-- Administration screen as a result of the V418 split. Going forward, new/updated Permission
-- Sets can grant the granular codes independently for finer delegation.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'documents.admin.view'
) src
JOIN permissions tgt ON tgt.code IN (
    'documents.admin.properties.view',
    'documents.admin.name_formats.view',
    'documents.admin.document_types.view',
    'documents.admin.knowledge_categories.view',
    'documents.admin.publishing_templates.view',
    'documents.admin.controlled_copies_policy.view'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'documents.admin.manage'
) src
JOIN permissions tgt ON tgt.code IN (
    'documents.admin.properties.manage',
    'documents.admin.name_formats.manage',
    'documents.admin.document_types.manage',
    'documents.admin.knowledge_categories.manage',
    'documents.admin.publishing_templates.manage',
    'documents.admin.controlled_copies_policy.manage'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
