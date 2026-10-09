-- Backup & Restore: the first actions that change something (SDS-BR-001). Viewing stays under backup.module.view (V485);
-- starting a backup and re-checking one are separate permissions so an Access Profile can grant them to the operator role
-- without granting administration. Both are audited. Restore permissions (request, approve, execute) come with the restore
-- feature and are deliberately not seeded here.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.backup.run', 'Run Backup',
     'Backup & Restore', 'backup', 'backup',
     'Start a manual or pre-change backup. A reason is required and the request is audited.', 203, TRUE),
    (gen_random_uuid(), 'backup.backup.verify', 'Verify Backup',
     'Backup & Restore', 'backup', 'backup',
     'Run the integrity check on an existing backup again. The result is added to the backup history, never replaced.', 204, TRUE)
ON CONFLICT (code) DO NOTHING;

-- An action needs the right to see the module it acts on.
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.backup.run', 'backup.module.view', 'REQUIRES', 'BKP-01', 'Starting a backup requires seeing Backup & Restore.'),
    ('backup.backup.verify', 'backup.module.view', 'REQUIRES', 'BKP-02', 'Verifying a backup requires seeing Backup & Restore.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

-- System Administration is the scope that operates the system (same grant as backup.module.view in V485). Other Access
-- Profiles do not get these automatically.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('backup.backup.run', 'backup.backup.verify')
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
