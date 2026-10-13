-- Disaster recovery drills (SDS 15.2): viewing them is backup.admin.disaster_recovery.view (V557). Recording a drill is a permission of its
-- own, given to SYSTEM_ADMINISTRATION. Recording does not need an electronic signature; each record is kept and cannot be edited.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.disaster_recovery.manage', 'Record Disaster Recovery Drills',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Record a disaster recovery drill that has been carried out, with its result and findings.', 205, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.admin.disaster_recovery.manage', 'backup.admin.disaster_recovery.view', 'REQUIRES', 'BKP-14', 'Recording a drill requires seeing the drills.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.disaster_recovery.manage'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
