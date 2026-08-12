-- Consolidate Security & Authorization grants onto canonical permission codes.
-- Runtime authorization is intentionally exact after this migration: no role-name
-- checks and no compatibility aliases may grant access.

CREATE TEMP TABLE legacy_security_permission_map (
    legacy_code VARCHAR(80) NOT NULL,
    canonical_code VARCHAR(80) NOT NULL,
    PRIMARY KEY (legacy_code, canonical_code)
) ON COMMIT DROP;

INSERT INTO legacy_security_permission_map (legacy_code, canonical_code) VALUES
    ('settings.role.view', 'security.access_profiles.view'),
    ('settings.role.view', 'security.permission_sets.view'),
    ('settings.role.view', 'security.workflow_authorization.view'),
    ('settings.role.view', 'security.object_rules.view'),
    ('settings.role.view', 'security.sod.view'),

    ('settings.role.manage', 'security.access_profiles.view'),
    ('settings.role.manage', 'security.access_profiles.update'),
    ('settings.role.manage', 'security.access_profiles.assign'),
    ('settings.role.manage', 'security.permission_sets.view'),
    ('settings.role.manage', 'security.permission_sets.update'),
    ('settings.role.manage', 'security.workflow_authorization.view'),
    ('settings.role.manage', 'security.workflow_authorization.manage'),
    ('settings.role.manage', 'security.object_rules.view'),
    ('settings.role.manage', 'security.object_rules.manage'),
    ('settings.role.manage', 'security.sod.view'),
    ('settings.role.manage', 'security.sod.manage'),

    ('settings.role.assign_permissions', 'security.access_profiles.view'),
    ('settings.role.assign_permissions', 'security.access_profiles.assign'),
    ('settings.role.assign_permissions', 'security.permission_sets.view'),
    ('settings.role.assign_permissions', 'security.permission_sets.update'),

    ('documents.admin.manage_sod_constraints', 'security.sod.view'),
    ('documents.admin.manage_sod_constraints', 'security.sod.manage');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM legacy_security_permission_map m
        LEFT JOIN permissions p ON p.code = m.canonical_code
        WHERE p.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Canonical security permission catalog is incomplete';
    END IF;
END $$;

-- Preserve Permission Set grants before removing legacy permission rows.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), old_item.permission_set_id, canonical_permission.id
FROM permission_set_items old_item
JOIN permissions legacy_permission ON legacy_permission.id = old_item.permission_id
JOIN legacy_security_permission_map mapping ON mapping.legacy_code = legacy_permission.code
JOIN permissions canonical_permission ON canonical_permission.code = mapping.canonical_code
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Preserve direct legacy role grants for installations that still retain them.
INSERT INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, canonical_permission.id
FROM role_permissions old_grant
JOIN permissions legacy_permission ON legacy_permission.id = old_grant.permission_id
JOIN legacy_security_permission_map mapping ON mapping.legacy_code = legacy_permission.code
JOIN permissions canonical_permission ON canonical_permission.code = mapping.canonical_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM permissions
WHERE code IN (
    'settings.role.view',
    'settings.role.manage',
    'settings.role.assign_permissions',
    'documents.admin.manage_sod_constraints'
);
