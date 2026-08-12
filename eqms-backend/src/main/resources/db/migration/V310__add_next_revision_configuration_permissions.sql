-- The next revision's routing and relationship configuration is independently
-- assignable.  These permissions replace the implicit workspace-management
-- check for the Active Document Master configuration actions.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'Revision Configuration', 'documents', 'revision_configuration', v.description, v.display_order, TRUE
FROM (VALUES
    ('documents.revision.configure_next_reviewers', 'Configure Next Revision Reviewers', 'Change reviewers inherited by the next revision of an Active document.', 665),
    ('documents.revision.configure_next_approvers', 'Configure Next Revision Approvers', 'Change approvers inherited by the next revision of an Active document.', 666),
    ('documents.revision.configure_next_related_documents', 'Configure Next Revision Related Documents', 'Change related documents inherited by the next revision of an Active document.', 667),
    ('documents.revision.configure_next_correlated_documents', 'Configure Next Revision Correlated Documents', 'Change correlated documents inherited by the next revision of an Active document.', 668)
) AS v(code, name, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM permissions existing WHERE existing.code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), source.permission_set_id, permission.id
FROM (
    SELECT DISTINCT item.permission_set_id
    FROM permission_set_items item
    JOIN permissions workspace ON workspace.id = item.permission_id
    WHERE workspace.code = 'documents.workspace.manage'
) source
JOIN permissions permission ON permission.code IN (
    'documents.revision.configure_next_reviewers',
    'documents.revision.configure_next_approvers',
    'documents.revision.configure_next_related_documents',
    'documents.revision.configure_next_correlated_documents'
)
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = source.permission_set_id AND existing.permission_id = permission.id
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT source.role_id, permission.id
FROM (
    SELECT DISTINCT assignment.role_id
    FROM role_permissions assignment
    JOIN permissions workspace ON workspace.id = assignment.permission_id
    WHERE workspace.code = 'documents.workspace.manage'
) source
JOIN permissions permission ON permission.code IN (
    'documents.revision.configure_next_reviewers',
    'documents.revision.configure_next_approvers',
    'documents.revision.configure_next_related_documents',
    'documents.revision.configure_next_correlated_documents'
)
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = source.role_id AND existing.permission_id = permission.id
);
