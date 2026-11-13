-- Backup and restore are done by the administrator only (owner decision of 2026-11-10). The separate finalization set of V752 is
-- folded into the administration set and removed; nobody else holds a backup or restore permission through a system set.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps JOIN permissions p ON p.code = 'backup.restore.finalize'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

DELETE FROM access_profile_permission_sets WHERE permission_set_id IN (SELECT id FROM permission_sets WHERE code = 'BACKUP_RESTORE_FINALIZATION');
DELETE FROM permission_set_items WHERE permission_set_id IN (SELECT id FROM permission_sets WHERE code = 'BACKUP_RESTORE_FINALIZATION');
DELETE FROM permission_sets WHERE code = 'BACKUP_RESTORE_FINALIZATION';
