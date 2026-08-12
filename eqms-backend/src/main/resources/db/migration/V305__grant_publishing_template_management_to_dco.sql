-- Publishing templates are a Document Control responsibility, not a blanket
-- system-configuration capability.  Give every DCO profile the narrow,
-- dedicated permissions while retaining the existing administrator grants.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('76111111-1111-1111-1111-111111113051'::uuid, 'settings.publishing_template.view',
        'View Publishing Templates', 'Application Settings', 'app-settings', 'document_control',
        'View publishing templates and their generated component previews.', 3051, FALSE),
    ('76111111-1111-1111-1111-111111113052'::uuid, 'settings.publishing_template.manage',
        'Manage Publishing Templates', 'Application Settings', 'app-settings', 'document_control',
        'Create, update, version, activate, and retire publishing templates.', 3052, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Publishing Template Manager', 'PS_PUBLISHING_TEMPLATE_MANAGER',
       'View and manage controlled publishing templates.', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'PS_PUBLISHING_TEMPLATE_MANAGER');

INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('settings.publishing_template.view', 'settings.publishing_template.manage')
WHERE ps.code = 'PS_PUBLISHING_TEMPLATE_MANAGER'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- New catalog DCO profiles receive the capability automatically.
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT apwr.access_profile_id, ps.id
FROM access_profile_workflow_roles apwr
JOIN permission_sets ps ON ps.code = 'PS_PUBLISHING_TEMPLATE_MANAGER'
WHERE apwr.workflow_role = 'DCO'
ON CONFLICT (access_profile_id, permission_set_id) DO NOTHING;

-- Preserve access for the legacy system DCO role, if it is still in use.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('settings.publishing_template.view', 'settings.publishing_template.manage')
WHERE UPPER(COALESCE(r.code, r.name, '')) IN ('DCO', 'DOCUMENT_CONTROL_OFFICER')
ON CONFLICT (role_id, permission_id) DO NOTHING;
