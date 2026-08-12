-- GMP Segregation of Duties: SYSTEM_SUPER_ADMIN must no longer receive an
-- implicit wildcard permission grant. This seeds an explicit "System
-- Administration" permission set covering only system configuration, user
-- management, security/access administration, and audit trail viewing.
-- Operational document/controlled-copy/revision actions are intentionally
-- excluded — Admin configures the system, it does not perform business
-- transactions unless separately granted like any other user.

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'System Administration', 'SYSTEM_ADMINISTRATION',
       'System administration scope for SYSTEM_SUPER_ADMIN: user management, access/security configuration, system settings, audit trail. Excludes all operational document/controlled-copy/revision permissions per GMP Segregation of Duties.',
       true, true
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'SYSTEM_ADMINISTRATION');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('SYSTEM_ADMINISTRATION', 'settings.user.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.user.create'),
    ('SYSTEM_ADMINISTRATION', 'settings.user.edit'),
    ('SYSTEM_ADMINISTRATION', 'settings.user.delete'),
    ('SYSTEM_ADMINISTRATION', 'settings.user.reset_password'),
    ('SYSTEM_ADMINISTRATION', 'settings.user.force_logout'),
    ('SYSTEM_ADMINISTRATION', 'settings.role.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.role.manage'),
    ('SYSTEM_ADMINISTRATION', 'settings.role.assign_permissions'),
    ('SYSTEM_ADMINISTRATION', 'security.access_profiles.view'),
    ('SYSTEM_ADMINISTRATION', 'security.access_profiles.update'),
    ('SYSTEM_ADMINISTRATION', 'security.access_profiles.assign'),
    ('SYSTEM_ADMINISTRATION', 'security.permission_sets.view'),
    ('SYSTEM_ADMINISTRATION', 'security.permission_sets.update'),
    ('SYSTEM_ADMINISTRATION', 'security.object_rules.view'),
    ('SYSTEM_ADMINISTRATION', 'security.object_rules.manage'),
    ('SYSTEM_ADMINISTRATION', 'security.sod.view'),
    ('SYSTEM_ADMINISTRATION', 'security.sod.manage'),
    ('SYSTEM_ADMINISTRATION', 'security.workflow_authorization.view'),
    ('SYSTEM_ADMINISTRATION', 'security.workflow_authorization.manage'),
    ('SYSTEM_ADMINISTRATION', 'security.access_review.view'),
    ('SYSTEM_ADMINISTRATION', 'security.access_review.manage'),
    ('SYSTEM_ADMINISTRATION', 'audit.view'),
    ('SYSTEM_ADMINISTRATION', 'audit.export'),
    ('SYSTEM_ADMINISTRATION', 'audittrail.module.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.configuration.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.configuration.edit'),
    ('SYSTEM_ADMINISTRATION', 'settings.configuration.manage'),
    ('SYSTEM_ADMINISTRATION', 'settings.controlled_copy_policy.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.controlled_copy_policy.manage'),
    ('SYSTEM_ADMINISTRATION', 'settings.dictionary.view'),
    ('SYSTEM_ADMINISTRATION', 'settings.dictionary.manage'),
    ('SYSTEM_ADMINISTRATION', 'settings.email_template.manage')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r, permission_sets ps
WHERE r.code = 'SYSTEM_SUPER_ADMIN' AND ps.code = 'SYSTEM_ADMINISTRATION'
AND NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets a
    WHERE a.access_profile_id = r.id AND a.permission_set_id = ps.id
);
