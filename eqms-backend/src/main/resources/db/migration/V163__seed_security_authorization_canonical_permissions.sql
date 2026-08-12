INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order)
VALUES
    (gen_random_uuid(), 'dashboard.admin.view', 'View Administrative Dashboard', 'Dashboard Access', 'dashboard', 'dashboard_admin', 'View administrative dashboard statistics and security-oriented overview widgets.', 102),
    (gen_random_uuid(), 'security.permission_sets.view', 'View Permission Sets', 'Security & Authorization', 'security-authorization', 'permission_sets', 'View permission sets and their assigned permissions.', 1801),
    (gen_random_uuid(), 'security.permission_sets.update', 'Manage Permission Sets', 'Security & Authorization', 'security-authorization', 'permission_sets', 'Create, update, clone, deactivate, and assign permission sets.', 1802),
    (gen_random_uuid(), 'security.access_profiles.view', 'View Access Profiles', 'Security & Authorization', 'security-authorization', 'access_profiles', 'View access profiles, business roles, and assignment summaries.', 1811),
    (gen_random_uuid(), 'security.access_profiles.update', 'Manage Access Profiles', 'Security & Authorization', 'security-authorization', 'access_profiles', 'Create, update, deactivate, clone, and administer access profiles.', 1812),
    (gen_random_uuid(), 'security.access_profiles.assign', 'Assign Access Profiles', 'Security & Authorization', 'security-authorization', 'access_profiles', 'Assign users, permission sets, workflow roles, and object rules to access profiles.', 1813),
    (gen_random_uuid(), 'security.workflow_authorization.view', 'View Workflow Authorization', 'Security & Authorization', 'security-authorization', 'workflow_authorization', 'View workflow authorization policies and actor rules.', 1821),
    (gen_random_uuid(), 'security.workflow_authorization.manage', 'Manage Workflow Authorization', 'Security & Authorization', 'security-authorization', 'workflow_authorization', 'Create and update workflow authorization policies and actor rules.', 1822),
    (gen_random_uuid(), 'security.object_rules.view', 'View Object Access Rules', 'Security & Authorization', 'security-authorization', 'object_access', 'View object access rules and organization scope policies.', 1831),
    (gen_random_uuid(), 'security.object_rules.manage', 'Manage Object Access Rules', 'Security & Authorization', 'security-authorization', 'object_access', 'Create, update, deactivate, and delete object access rules.', 1832),
    (gen_random_uuid(), 'security.sod.view', 'View Segregation of Duties', 'Security & Authorization', 'security-authorization', 'segregation_of_duties', 'View segregation-of-duties constraints and violation scans.', 1841),
    (gen_random_uuid(), 'security.sod.manage', 'Manage Segregation of Duties', 'Security & Authorization', 'security-authorization', 'segregation_of_duties', 'Create, update, and deactivate segregation-of-duties constraints.', 1842),
    (gen_random_uuid(), 'settings.dictionary.view', 'View Data Dictionaries', 'Application Settings', 'app-settings', 'data_dictionaries', 'View controlled dictionary values such as business units, departments, document types, and retention policies.', 1901),
    (gen_random_uuid(), 'settings.dictionary.manage', 'Manage Data Dictionaries', 'Application Settings', 'app-settings', 'data_dictionaries', 'Create, update, and delete controlled dictionary values used by GxP records.', 1902)
ON CONFLICT (code) DO UPDATE SET
    name        = EXCLUDED.name,
    category    = EXCLUDED.category,
    module_key  = EXCLUDED.module_key,
    group_key   = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'dashboard.admin.view',
    'security.permission_sets.view',
    'security.permission_sets.update',
    'security.access_profiles.view',
    'security.access_profiles.update',
    'security.access_profiles.assign',
    'security.workflow_authorization.view',
    'security.workflow_authorization.manage',
    'security.object_rules.view',
    'security.object_rules.manage',
    'security.sod.view',
    'security.sod.manage',
    'settings.dictionary.view',
    'settings.dictionary.manage'
)
WHERE UPPER(COALESCE(r.code, r.name)) IN ('SYSTEM_SUPER_ADMIN', 'ADMINISTRATOR', 'DCO')
ON CONFLICT DO NOTHING;
