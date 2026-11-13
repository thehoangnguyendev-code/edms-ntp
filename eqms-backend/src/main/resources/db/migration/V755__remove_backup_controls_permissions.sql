-- The Backup Controls screen was removed (2026-11-11): it only described fixed rules in text and had no data or action. Nothing reads
-- these two view permissions any more. The retention rule itself (backups are kept permanently) stays a recorded decision.
DELETE FROM permission_set_items WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('backup.admin.verification.view', 'backup.admin.retention.view'));
DELETE FROM permissions WHERE code IN ('backup.admin.verification.view', 'backup.admin.retention.view');
