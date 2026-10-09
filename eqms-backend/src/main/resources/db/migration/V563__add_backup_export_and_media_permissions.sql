-- Export Backup Set and the Offline Media Register (SDS-BR-001 section 6.5 and the role table in section 18). Requesting an export,
-- approving it and looking after the physical media are three different permissions, so an Access Profile can give them to
-- different people (decision BR-14: the approver is never the requester; the Backup Agent also refuses that). Viewing the media
-- register is part of backup.admin.storage.view (V556). All of them are audited.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.backup.export', 'Request Backup Export',
     'Backup & Restore', 'backup', 'backup',
     'Ask for a verified backup, with everything it depends on, to be written to a registered offline medium. A second person must approve it.', 207, TRUE),
    (gen_random_uuid(), 'backup.backup.export.approve', 'Approve Backup Export',
     'Backup & Restore', 'backup', 'backup',
     'Approve or reject a request to export a backup to an offline medium. The approver cannot be the person who asked.', 208, TRUE),
    (gen_random_uuid(), 'backup.media.manage', 'Manage Offline Media',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Register offline media, record their handover and receipt, read tests, reuse and destruction.', 209, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.backup.export', 'backup.module.view', 'REQUIRES', 'BKP-05', 'Requesting an export requires seeing Backup & Restore.'),
    ('backup.backup.export.approve', 'backup.module.view', 'REQUIRES', 'BKP-06', 'Approving an export requires seeing Backup & Restore.'),
    ('backup.media.manage', 'backup.admin.storage.view', 'REQUIRES', 'BKP-07', 'Looking after media requires seeing the Storage & Encryption screen that holds the register.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('backup.backup.export', 'backup.backup.export.approve', 'backup.media.manage')
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
