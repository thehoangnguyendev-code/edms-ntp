-- Backup & Restore menu (feature to be developed later). Only the module-level "view" permission is seeded now so the
-- sidebar entry, route and status endpoint can be access-controlled like every other module; the actions that will
-- actually create/restore backups get their own, separate permissions (Segregation of Duties) when they are built.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'backup.module.view', 'View Backup & Restore', 'System Governance',
        'backup', 'system_governance', 'Access the Backup & Restore module.', 195, FALSE)
ON CONFLICT (code) DO NOTHING;

-- System Administration is the scope that configures the system; it receives the new view permission. Other
-- Access Profiles do not get it automatically.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.module.view'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
