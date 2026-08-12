-- Initial document setup and next-revision setup are separate business cases.
-- This permission governs routing and relationships entered while a new
-- Document Master is being created; V310 governs later upgrades.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(),
       'documents.document.configure_initial_workflow',
       'Configure Initial Document Workflow',
       'Document Authoring',
       'documents',
       'document_authoring',
       'Configure reviewers, approvers, and document relationships during initial Document Master creation.',
       664,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'documents.document.configure_initial_workflow'
);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), source.permission_set_id, configuration_permission.id
FROM (
    SELECT DISTINCT item.permission_set_id
    FROM permission_set_items item
    JOIN permissions workspace ON workspace.id = item.permission_id
    WHERE workspace.code = 'documents.workspace.manage'
) source
JOIN permissions configuration_permission ON configuration_permission.code = 'documents.document.configure_initial_workflow'
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = source.permission_set_id
      AND existing.permission_id = configuration_permission.id
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT source.role_id, configuration_permission.id
FROM (
    SELECT DISTINCT assignment.role_id
    FROM role_permissions assignment
    JOIN permissions workspace ON workspace.id = assignment.permission_id
    WHERE workspace.code = 'documents.workspace.manage'
) source
JOIN permissions configuration_permission ON configuration_permission.code = 'documents.document.configure_initial_workflow'
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = source.role_id
      AND existing.permission_id = configuration_permission.id
);
