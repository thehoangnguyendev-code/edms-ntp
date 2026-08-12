-- Access Profile and Workflow Role labels are administrative display values.
-- Runtime decisions must use permission grants and immutable IDs/codes only.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT v.id, v.code, v.name, v.category, v.module_key, v.group_key, v.description, v.display_order, v.requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111287'::uuid,
        'security.maintenance.bypass',
        'Bypass Maintenance Mode',
        'System Security',
        'security',
        'system_access',
        'Access the application while scheduled maintenance mode is enabled.',
        787,
        TRUE),
    ('72111111-1111-1111-1111-111111111288'::uuid,
        'notifications.recipient.qa_manager',
        'Receive QA Manager Notifications',
        'Notifications',
        'notifications',
        'recipient_audiences',
        'Receive notification-policy recipients configured as QA Manager. Grant through an Access Profile/Permission Set; this is not inferred from a role name.',
        788,
        FALSE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- System administrators retain their existing maintenance operational
-- responsibility through a normal, auditable permission grant. No role name
-- is consulted by the frontend or API filter.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'security.maintenance.bypass'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id
        AND existing.permission_id = p.id
  );
