-- Restore rules (SDS 14.1, owner-changeable values): viewing them is backup.admin.restore_controls.view (V556); changing one is a
-- permission of its own and carries an electronic signature with its own meaning. Given to SYSTEM_ADMINISTRATION.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.restore_rules.manage', 'Change Restore Rules',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Change the restore rules that the owner may set (for example, how long a test restore stays valid). Needs an electronic signature.', 204, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.admin.restore_rules.manage', 'backup.admin.restore_controls.view', 'REQUIRES', 'BKP-13', 'Changing a restore rule requires seeing the rules.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.restore_rules.manage'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'BACKUP_RESTORE_RULE_CHANGE', 'Backup Restore Rule Change')
ON CONFLICT (code) DO NOTHING;
