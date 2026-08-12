INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    ('71111111-1111-1111-1111-111111111137', 'documents.training.manage', 'Manage Training Plan', 'Document Training', 'documents', 'training_publish', 'Manage document-related training plans and distribution readiness.', 52, TRUE),
    ('71111111-1111-1111-1111-111111111138', 'documents.training.complete', 'Complete Training', 'Document Training', 'documents', 'training_publish', 'Complete document revision training workflow steps.', 53, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    requires_audit = EXCLUDED.requires_audit;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('documents.training.manage', 'documents.training.complete')
WHERE UPPER(r.name) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN', 'DCO')
   OR UPPER(r.code) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN', 'DCO')
ON CONFLICT DO NOTHING;
