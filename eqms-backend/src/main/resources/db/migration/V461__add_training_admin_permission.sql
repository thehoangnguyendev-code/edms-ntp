-- Training Administration (System Administration > Training Administration) -- currently a
-- "Coming Soon" placeholder with no functionality behind it yet, but the menu entry needs its own
-- view permission from day one so it's not silently gated by an unrelated code.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'training.admin.view', 'View Training Administration',
        'Training Administration', 'training', 'training_admin',
        'View the Training Administration section under System Administration.',
        61, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Backfill: every Permission Set that already grants training.module.view (i.e. anyone using
-- Training today) also receives the new permission, so the "coming soon" entry shows up for them
-- immediately rather than requiring a separate grant for a screen with no real content yet.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), src.permission_set_id, tgt.id
FROM (
    SELECT DISTINCT psi.permission_set_id
    FROM permission_set_items psi
    JOIN permissions p ON p.id = psi.permission_id
    WHERE p.code = 'training.module.view'
) src
JOIN permissions tgt ON tgt.code = 'training.admin.view'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
