-- V826: Document Control department visibility level (Decision VISIBILITY-TIERS-2026-11-20).
--
-- A third way to see Document Control records, between "named in the flow" and "view everything": the Documents and Revisions whose Department
-- (written on the Document when it is created) is the person's own Department. It is a permission, like the view-everything one, so an Access
-- Profile grants it and the effective level of a person is the highest of the profiles. Nothing is granted by this migration: no account
-- sees more or less until an administrator gives the permission to a profile.
--
-- 1. The permission.
-- 2. A permission set that carries it together with the base view permissions (like PS_DOCUMENT_VIEW_ALL), so attaching it alone to an Access
--    Profile is enough. Copies have no department level: a Controlled or Uncontrolled Copy is seen by the people named in the flow of its
--    revision, by its recipient and by the holders of the matching view-all permission.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'documents.document.view_department', 'View Department Document Records', 'Document Master', 'documents', 'document_control_access',
       'See every Document and Revision of your own Department, drafts included, with or without a name in the flow. Read-only: acting needs a name in the flow.',
       778, false
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'documents.document.view_department');

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Document Control - View Department', 'PS_DOCUMENT_VIEW_DEPARTMENT',
       'See every Document and Revision of your own Department (drafts included). Acting still needs a name in the flow or the operational permission.',
       true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_DOCUMENT_VIEW_DEPARTMENT');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission.code IN (
    'documents.module.view',
    'documents.document.view',
    'documents.document.view_department')
WHERE permission_set.code = 'PS_DOCUMENT_VIEW_DEPARTMENT'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
