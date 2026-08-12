-- Per user request: "view all documents" (the DCO-equivalent blanket document visibility bypass)
-- must not be hardcoded to a workflow role named "DCO" — it should be driven entirely by
-- permission, so renaming/restructuring roles later has no effect on the code. This adds a
-- dedicated permission code and grants it to every access profile that currently carries the
-- "DCO" workflow role (legacy pool table or the new access_profile_workflow_roles catalog), so
-- no currently-authorized account loses access. DocumentAuthorizationService.canViewAllDocuments
-- checks this permission first; the workflow-role/pool lookups remain only as a compatibility
-- fallback for any account not yet migrated to holding the permission directly.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'documents.document.view_all', 'View All Documents', 'Document Master', 'documents', 'document_master',
       'Blanket visibility over every document regardless of authorship, workflow participation, or object-access scope — independent of any specific role name.',
       0, false
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'documents.document.view_all');

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Document View All', 'PS_DOCUMENT_VIEW_ALL',
       'Grants blanket visibility over every document, independent of role naming.',
       true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_DOCUMENT_VIEW_ALL');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps, permissions p
WHERE ps.code = 'PS_DOCUMENT_VIEW_ALL'
AND p.code = 'documents.document.view_all'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);

-- Grant to every access profile currently carrying the "DCO" workflow role via either path, so
-- the new permission-based check is a strict superset of today's role-name-based access.
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT DISTINCT r.id, ps.id
FROM roles r
JOIN permission_sets ps ON ps.code = 'PS_DOCUMENT_VIEW_ALL'
WHERE r.id IN (
    SELECT access_profile_id FROM access_profile_workflow_roles WHERE workflow_role = 'DCO'
)
AND NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets a
    WHERE a.access_profile_id = r.id AND a.permission_set_id = ps.id
);
