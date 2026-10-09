-- Backup & Restore Administration (System Administration > Backup & Restore Administration). The screens are a UI
-- preview with no server behaviour yet, but each one gets its own view permission from day one (mirrors the Training
-- Administration and Document Administration per-screen split), so an Access Profile can delegate a single screen
-- later. Only view permissions are seeded: the actions that change the configuration or run a restore get their own,
-- separate permissions (Segregation of Duties) when the backend is built.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.view', 'View Backup & Restore Administration',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Backup & Restore Administration section under System Administration.', 196, FALSE),
    (gen_random_uuid(), 'backup.admin.policy.view', 'View Backup Policy',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Backup Policy section under Backup & Restore Administration.', 197, FALSE),
    (gen_random_uuid(), 'backup.admin.retention.view', 'View Retention & Legal Hold',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Retention & Legal Hold section under Backup & Restore Administration.', 198, FALSE),
    (gen_random_uuid(), 'backup.admin.storage.view', 'View Storage & Encryption',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Storage & Encryption section under Backup & Restore Administration.', 199, FALSE),
    (gen_random_uuid(), 'backup.admin.verification.view', 'View Verification & Drills',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Verification & Drills section under Backup & Restore Administration.', 200, FALSE),
    (gen_random_uuid(), 'backup.admin.restore_controls.view', 'View Restore Controls',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Restore Controls section under Backup & Restore Administration.', 201, FALSE),
    (gen_random_uuid(), 'backup.admin.alerts.view', 'View Backup Alerts',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'View the Alerts section under Backup & Restore Administration.', 202, FALSE)
ON CONFLICT (code) DO NOTHING;

-- System Administration is the scope that configures the system (same grant as backup.module.view in V485). Other
-- Access Profiles do not get these automatically.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code LIKE 'backup.admin.%'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
