-- Restore requests (SDS-BR-001 section 11.3, steps R0-R3) and their approval (section 9, decision BR-10). Asking, approving and
-- deciding are three permissions, so the people who ask and the people who approve can be different roles. Approving carries an
-- electronic signature with its own meaning. Executing a restore has its own permission and is NOT seeded here: it is not built yet.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.restore.request', 'Request Restore',
     'Backup & Restore', 'backup', 'backup',
     'Ask for a verified backup to be restored to validation or production. The request is checked against its impact report and waits for approval.', 212, TRUE),
    (gen_random_uuid(), 'backup.restore.approve', 'Approve Restore',
     'Backup & Restore', 'backup', 'backup',
     'Approve or reject a restore request. The approver must be a different person from the requester, and approval needs an electronic signature.', 213, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.restore.request', 'backup.module.view', 'REQUIRES', 'BKP-10', 'Requesting a restore requires seeing Backup & Restore.'),
    ('backup.restore.approve', 'backup.module.view', 'REQUIRES', 'BKP-11', 'Approving a restore requires seeing Backup & Restore.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('backup.restore.request', 'backup.restore.approve')
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'BACKUP_RESTORE_APPROVAL', 'Backup Restore Approval')
ON CONFLICT (code) DO NOTHING;
