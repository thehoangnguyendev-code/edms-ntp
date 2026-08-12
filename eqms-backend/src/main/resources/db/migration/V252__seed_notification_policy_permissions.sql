-- Permissions for the redesigned Notification Policy module (event catalog -> policy -> content).
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'System Settings', 'settings', 'system_settings', v.description, 0, v.requires_audit
FROM (VALUES
    ('settings.notification_policy.view', 'View Notification Policies', 'View the notification event catalog, delivery rules, and content.', false),
    ('settings.notification_policy.manage', 'Manage Notification Policies', 'Edit notification delivery rules, recipients, and content templates.', true)
) AS v(code, name, description, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_MODULE_SETTINGS_MANAGER', 'settings.notification_policy.view'),
    ('PS_MODULE_SETTINGS_MANAGER', 'settings.notification_policy.manage'),
    ('SYSTEM_ADMINISTRATION', 'settings.notification_policy.view')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
