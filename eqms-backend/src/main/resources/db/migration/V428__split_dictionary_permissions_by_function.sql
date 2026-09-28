-- Split the former catch-all dictionary permissions into the independently navigable
-- Settings functions. Existing grants are expanded, never removed, so deployment does
-- not revoke access from an existing role or permission set.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order)
VALUES
    (gen_random_uuid(), 'settings.business_unit.view', 'View Business Units', 'Application Settings', 'app-settings', 'business_units', 'View Business Unit master data.', 1901),
    (gen_random_uuid(), 'settings.business_unit.manage', 'Manage Business Units', 'Application Settings', 'app-settings', 'business_units', 'Create, update, and delete Business Unit master data.', 1902),
    (gen_random_uuid(), 'settings.department.view', 'View Departments', 'Application Settings', 'app-settings', 'departments', 'View Department master data.', 1903),
    (gen_random_uuid(), 'settings.department.manage', 'Manage Departments', 'Application Settings', 'app-settings', 'departments', 'Create, update, and delete Department master data.', 1904),
    (gen_random_uuid(), 'settings.position.view', 'View Positions', 'Application Settings', 'app-settings', 'positions', 'View Position master data.', 1905),
    (gen_random_uuid(), 'settings.position.manage', 'Manage Positions', 'Application Settings', 'app-settings', 'positions', 'Create, update, and delete Position master data.', 1906),
    (gen_random_uuid(), 'settings.storage_location.view', 'View Storage Locations', 'Application Settings', 'app-settings', 'storage_locations', 'View Storage Location master data.', 1907),
    (gen_random_uuid(), 'settings.storage_location.manage', 'Manage Storage Locations', 'Application Settings', 'app-settings', 'storage_locations', 'Create, update, and delete Storage Location master data.', 1908),
    (gen_random_uuid(), 'settings.retention_policy.view', 'View Retention Policies', 'Application Settings', 'app-settings', 'retention_policies', 'View Retention Policy master data.', 1909),
    (gen_random_uuid(), 'settings.retention_policy.manage', 'Manage Retention Policies', 'Application Settings', 'app-settings', 'retention_policies', 'Create, update, and delete Retention Policy master data.', 1910),
    (gen_random_uuid(), 'settings.country.view', 'View Countries', 'Application Settings', 'app-settings', 'countries', 'View Country master data.', 1911),
    (gen_random_uuid(), 'settings.country.manage', 'Manage Countries', 'Application Settings', 'app-settings', 'countries', 'Create, update, and delete Country master data.', 1912),
    (gen_random_uuid(), 'settings.education.degree_level.view', 'View Education Degree Levels', 'Application Settings', 'app-settings', 'education_degree_levels', 'View Education Degree Level master data.', 1913),
    (gen_random_uuid(), 'settings.education.degree_level.manage', 'Manage Education Degree Levels', 'Application Settings', 'app-settings', 'education_degree_levels', 'Create, update, and delete Education Degree Level master data.', 1914),
    (gen_random_uuid(), 'settings.education.school.view', 'View Education Schools', 'Application Settings', 'app-settings', 'education_schools', 'View Education School master data.', 1915),
    (gen_random_uuid(), 'settings.education.school.manage', 'Manage Education Schools', 'Application Settings', 'app-settings', 'education_schools', 'Create, update, and delete Education School master data.', 1916)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- A former view grant becomes view access to each separated screen. A former manage grant
-- becomes both view and manage access, satisfying the same-screen prerequisite without a gap.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code IN (
    'settings.business_unit.view', 'settings.business_unit.manage',
    'settings.department.view', 'settings.department.manage',
    'settings.position.view', 'settings.position.manage',
    'settings.storage_location.view', 'settings.storage_location.manage',
    'settings.retention_policy.view', 'settings.retention_policy.manage',
    'settings.country.view', 'settings.country.manage',
    'settings.education.degree_level.view', 'settings.education.degree_level.manage',
    'settings.education.school.view', 'settings.education.school.manage'
)
WHERE old_permission.code IN ('settings.dictionary.view', 'settings.dictionary.manage')
  AND (old_permission.code = 'settings.dictionary.manage' OR target.code LIKE '%.view')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT legacy.role_id, target.id
FROM role_permissions legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code IN (
    'settings.business_unit.view', 'settings.business_unit.manage',
    'settings.department.view', 'settings.department.manage',
    'settings.position.view', 'settings.position.manage',
    'settings.storage_location.view', 'settings.storage_location.manage',
    'settings.retention_policy.view', 'settings.retention_policy.manage',
    'settings.country.view', 'settings.country.manage',
    'settings.education.degree_level.view', 'settings.education.degree_level.manage',
    'settings.education.school.view', 'settings.education.school.manage'
)
WHERE old_permission.code IN ('settings.dictionary.view', 'settings.dictionary.manage')
  AND (old_permission.code = 'settings.dictionary.manage' OR target.code LIKE '%.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
