-- Restore execution (SDS-BR-001 section 9, decision BR-8 closed on 2026-10-09). Execution is a separate permission: only a person who
-- holds it may start a restore, and only after the restore request is APPROVED by a different person (backup.restore.approve).
-- No separate key-holder mechanism: decryption is part of the approved, executed restore. The permission is granted to the
-- administration set here; a person who approves a request must not be the one who executes it (checked when execution is built).
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.restore.execute', 'Execute Approved Restore',
     'Backup & Restore', 'backup', 'backup',
     'Start an approved restore request in a maintenance window. Only an approved request can be executed, and the executor must not be its approver.', 214, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.restore.execute', 'backup.module.view', 'REQUIRES', 'BKP-12', 'Executing a restore requires seeing Backup & Restore.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.restore.execute'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
