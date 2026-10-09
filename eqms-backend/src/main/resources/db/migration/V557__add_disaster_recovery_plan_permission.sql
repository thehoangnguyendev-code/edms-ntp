-- Disaster Recovery Plan screen under Backup & Restore Administration (V556 added the other screens). Same pattern:
-- its own view permission, granted to the System Administration scope only.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (gen_random_uuid(), 'backup.admin.disaster_recovery.view', 'View Disaster Recovery Plan',
        'Backup & Restore Administration', 'backup', 'backup_admin',
        'View the Disaster Recovery Plan section under Backup & Restore Administration.', 203, FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.disaster_recovery.view'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
