-- Backup alerts (SDS 15.1): acknowledging an alert and managing who receives them are a permission of their own. Viewing the alerts is
-- backup.admin.alerts.view (V556). Changes are recorded in the ledger of the backup agent, and in the eQMS audit trail.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.alerts.manage', 'Manage Backup Alerts',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Acknowledge backup alerts and choose the people who receive them.', 203, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.admin.alerts.manage', 'backup.admin.alerts.view', 'REQUIRES', 'BKP-12', 'Managing alerts requires seeing them.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.alerts.manage'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
