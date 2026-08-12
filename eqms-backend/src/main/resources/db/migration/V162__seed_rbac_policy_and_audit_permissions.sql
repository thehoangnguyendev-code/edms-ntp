-- V162: Seed RBAC permissions introduced during the global authorization cleanup.
-- These permissions align FE route/menu gates with backend API checks.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('76111111-1111-1111-1111-111111111621'::uuid, 'audittrail.module.export',                  'Export Audit Trail',                    'Audit Trail',          'audit-trail',  'audit_trail_access', 'Export audit trail records for controlled review and inspection.',                 621, TRUE),
    ('76111111-1111-1111-1111-111111111622'::uuid, 'settings.controlled_copy_policy.view',       'View Controlled Copies Policy',         'Application Settings', 'app-settings', 'document_control',   'View controlled copy distribution, expiry, recall, and security policy.',          622, FALSE),
    ('76111111-1111-1111-1111-111111111623'::uuid, 'settings.controlled_copy_policy.manage',     'Manage Controlled Copies Policy',       'Application Settings', 'app-settings', 'document_control',   'Update controlled copy distribution, expiry, recall, and security policy.',        623, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Preserve current operational behavior: Administrators and DCOs keep access to
-- controlled copy policy and audit export after the permissions become explicit.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN (
    'ADMINISTRATOR', 'SYSTEM_SUPER_ADMIN', 'DOCUMENT_ADMIN', 'DCO',
    'DOCUMENT_CONTROL_OFFICER', 'DOCUMENT_CONTROL_ADMIN', 'QA_ADMIN', 'QA_MANAGER'
)
  AND p.code IN (
      'audittrail.module.export',
      'settings.controlled_copy_policy.view',
      'settings.controlled_copy_policy.manage'
  )
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
