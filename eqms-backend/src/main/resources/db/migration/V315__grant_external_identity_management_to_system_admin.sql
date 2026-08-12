-- External identity provisioning is a system-administration capability. Keep it
-- permission based while making it available to the built-in System Super Admin.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('users.invite_external'),
    ('users.resend_external_invitation'),
    ('users.retry_external_provisioning'),
    ('users.disable_microsoft_access'),
    ('users.view_external_provisioning')
) AS v(perm_code)
JOIN permission_sets ps ON ps.code = 'SYSTEM_ADMINISTRATION'
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
