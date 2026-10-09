-- Testing a backup target writes a small random file to it, reads it back and (for an immutable target) tries to delete it.
-- It changes nothing that matters but it does touch the target, so it has its own permission and is audited.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.storage.test', 'Test Backup Target',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Write, read back and (for immutable targets) try to delete a small test file on a backup target to prove it works.', 210, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES ('backup.admin.storage.test', 'backup.admin.storage.view', 'REQUIRES', 'BKP-08', 'Testing a target requires seeing the Storage & Encryption screen.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.storage.test'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
