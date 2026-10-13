-- Restore rehearsal (SDS-BR-001 sections 14.1 and 18): a test restore of a verified backup into a scratch database, with the
-- post-restore checks, and the scratch database dropped afterwards. It never touches production. Viewing the results is part of
-- the Backup & Restore module view; asking for a test is its own permission so an Access Profile can grant it separately.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.restore.test', 'Request Restore Test',
     'Backup & Restore', 'backup', 'backup',
     'Ask for a verified backup to be restored into a scratch database and checked. Production is not changed. The request is audited.', 211, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES ('backup.restore.test', 'backup.module.view', 'REQUIRES', 'BKP-09', 'Requesting a restore test requires seeing Backup & Restore.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.restore.test'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
