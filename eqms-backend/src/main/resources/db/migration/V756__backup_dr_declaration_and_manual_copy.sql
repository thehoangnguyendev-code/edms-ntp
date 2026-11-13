-- Declaring a disaster and closing the declaration are electronic signatures with a meaning of their own. Recording the copy a person
-- makes by hand is a permission of its own (it is a record of something done outside the system); the administrator holds it.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'BACKUP_DR_DECLARE', 'Disaster Declaration'),
    (gen_random_uuid(), 'BACKUP_DR_CLOSE', 'Disaster Declaration Closure')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.manual_copy.manage', 'Record Manual Backup Copies',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Record the copy of the backups that a person makes by hand and keeps outside the system.', 204, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'backup.admin.manual_copy.manage'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
