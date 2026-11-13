-- Restore into production, simplified (SDS-BR-003, Decision Log BACKUP-RESTORE-SIMPLIFIED-2026-11-09).
-- A restore waits in PENDING_FINALIZATION and can be rolled back until a person who holds backup.restore.finalize closes it.
-- The permission is NOT given to SYSTEM_ADMINISTRATION: the administrator grants it to a QA user through the set below.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.restore.finalize', 'Finalize Restore',
     'Backup & Restore', 'backup', 'backup',
     'Close a restore that has been swapped in. After this the restore can no longer be rolled back. Needs an electronic signature.', 215, TRUE)
ON CONFLICT (code) DO NOTHING;

-- The dependency on backup.module.view is enforced by the permission set below, which carries both permissions.

INSERT INTO permission_sets (id, name, code, description, active, system)
VALUES (gen_random_uuid(), 'Backup Restore Finalization', 'BACKUP_RESTORE_FINALIZATION',
        'Closes a restore after the data has been checked. Granted by the administrator to a QA user.', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('backup.restore.finalize', 'backup.module.view')
WHERE ps.code = 'BACKUP_RESTORE_FINALIZATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'BACKUP_RESTORE_EXECUTION', 'Backup Restore Execution'),
    (gen_random_uuid(), 'BACKUP_RESTORE_ROLLBACK', 'Backup Restore Rollback'),
    (gen_random_uuid(), 'BACKUP_RESTORE_FINALIZATION', 'Backup Restore Finalization')
ON CONFLICT (code) DO NOTHING;
