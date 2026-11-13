-- Permissions of features that were removed from Backup & Restore (decision of 2026-11-10): the restore request and approval flow, the
-- export of backup sets, the offline media register and the restore rules. No code reads them. Electronic-signature meanings are kept:
-- signatures already given with them stay valid evidence.
DELETE FROM permission_set_items WHERE permission_id IN (SELECT id FROM permissions WHERE code IN (
    'backup.restore.request', 'backup.restore.approve', 'backup.backup.export', 'backup.backup.export.approve',
    'backup.media.manage', 'backup.admin.restore_rules.manage', 'backup.admin.restore_controls.view'));
DELETE FROM permissions WHERE code IN (
    'backup.restore.request', 'backup.restore.approve', 'backup.backup.export', 'backup.backup.export.approve',
    'backup.media.manage', 'backup.admin.restore_rules.manage', 'backup.admin.restore_controls.view');
