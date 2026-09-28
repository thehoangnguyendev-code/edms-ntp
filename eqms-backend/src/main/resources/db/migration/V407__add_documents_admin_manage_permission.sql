-- Document Administration (the nested sub-group of the Document Control module: Document
-- Properties, Name Formats, Document Types / Sub-Types, Knowledge Categories, Publishing
-- Templates, Controlled Copies Policy) is now gated by a dedicated permission family instead
-- of borrowing settings.dictionary.* / settings.publishing_template.* / settings.controlled_copy_policy.*.
--
--   documents.admin.view    - already seeded in V41 ("Access Document Administration")
--   documents.admin.manage  - NEW: create / edit within those screens
--
-- To preserve current access, every permission set that today grants any of the retired
-- codes (or settings.configuration.* = admin) also receives the documents.admin.* pair.

-- 1. Seed the new manage permission.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (
    gen_random_uuid(),
    'documents.admin.manage',
    'Manage Document Administration',
    'Document Administration',
    'documents',
    'document_administration',
    'Create and edit document types, sub-types, publishing templates, controlled-copy policy and document properties.',
    35,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- 2. Grant documents.admin.view to every set that currently grants a matching VIEW- or
--    MANAGE-tier code for the retired feature permissions (or admin configuration).
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code IN (
        'settings.dictionary.view', 'settings.dictionary.manage',
        'settings.publishing_template.view', 'settings.publishing_template.manage',
        'settings.controlled_copy_policy.view', 'settings.controlled_copy_policy.manage',
        'settings.configuration.view', 'settings.configuration.manage'
    )
) src
JOIN permissions tgt ON tgt.code = 'documents.admin.view'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- 3. Grant documents.admin.manage to every set that currently grants a MANAGE-tier code.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code IN (
        'settings.dictionary.manage',
        'settings.publishing_template.manage',
        'settings.controlled_copy_policy.manage',
        'settings.configuration.manage'
    )
) src
JOIN permissions tgt ON tgt.code = 'documents.admin.manage'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
