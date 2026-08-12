INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    ('71111111-1111-1111-1111-111111111101', 'dashboard.module.view', 'View Dashboard', 'Dashboard Access', 'dashboard', 'dashboard_access', 'Access the system dashboard and KPI widgets.', 10, FALSE),
    ('71111111-1111-1111-1111-111111111102', 'documents.module.view', 'View Document Control', 'Document Control Access', 'documents', 'document_control_access', 'Access the Document Control module.', 20, FALSE),
    ('71111111-1111-1111-1111-111111111103', 'documents.admin.view', 'Access Document Administration', 'Document Administration', 'documents', 'document_administration', 'View Document Administration and workflow policy settings.', 30, FALSE),
    ('71111111-1111-1111-1111-111111111104', 'documents.admin.manage_workflow_roles', 'Manage Document Workflow Roles', 'Document Administration', 'documents', 'document_administration', 'Manage DCO, reviewer, and approver workflow pools.', 40, TRUE),
    ('71111111-1111-1111-1111-111111111105', 'documents.admin.manage_sod_constraints', 'Manage SoD Constraints', 'Document Administration', 'documents', 'document_administration', 'Maintain segregation-of-duties constraints for document workflows.', 50, TRUE),
    ('71111111-1111-1111-1111-111111111106', 'training.module.view', 'View Training', 'Training Access', 'training', 'training_access', 'Access the Training module and assigned training items.', 60, FALSE),
    ('71111111-1111-1111-1111-111111111107', 'training.material.manage', 'Manage Training Materials', 'Training Administration', 'training', 'training_admin', 'Create, update, review, and approve training materials.', 70, TRUE),
    ('71111111-1111-1111-1111-111111111108', 'deviations.module.view', 'View Deviations', 'Quality Modules', 'deviations', 'quality_modules', 'Access the Deviations module.', 80, FALSE),
    ('71111111-1111-1111-1111-111111111109', 'change_control.module.view', 'View Change Control', 'Quality Modules', 'change-control', 'quality_modules', 'Access the Change Control module.', 90, FALSE),
    ('71111111-1111-1111-1111-111111111110', 'capa.module.view', 'View CAPA', 'Quality Modules', 'capa', 'quality_modules', 'Access the CAPA module.', 100, FALSE),
    ('71111111-1111-1111-1111-111111111111', 'complaints.module.view', 'View Complaints', 'Quality Modules', 'complaints', 'quality_modules', 'Access the Complaints module.', 110, FALSE),
    ('71111111-1111-1111-1111-111111111112', 'risk_management.module.view', 'View Risk Management', 'Quality Modules', 'risk-management', 'quality_modules', 'Access the Risk Management module.', 120, FALSE),
    ('71111111-1111-1111-1111-111111111113', 'equipment.module.view', 'View Equipment', 'Operations Modules', 'equipment', 'operations_modules', 'Access the Equipment module.', 130, FALSE),
    ('71111111-1111-1111-1111-111111111114', 'supplier.module.view', 'View Supplier Management', 'Operations Modules', 'supplier', 'operations_modules', 'Access the Supplier module.', 140, FALSE),
    ('71111111-1111-1111-1111-111111111115', 'product.module.view', 'View Product', 'Operations Modules', 'product', 'operations_modules', 'Access the Product module.', 150, FALSE),
    ('71111111-1111-1111-1111-111111111116', 'regulatory.module.view', 'View Regulatory', 'Operations Modules', 'regulatory', 'operations_modules', 'Access the Regulatory module.', 160, FALSE),
    ('71111111-1111-1111-1111-111111111117', 'report.module.view', 'View Reports', 'Reporting', 'report', 'system_reporting', 'Access system reports and reporting workspaces.', 170, FALSE),
    ('71111111-1111-1111-1111-111111111118', 'report.module.export', 'Export Reports', 'Reporting', 'report', 'system_reporting', 'Export reports and compliance data extracts.', 180, TRUE),
    ('71111111-1111-1111-1111-111111111119', 'audittrail.module.view', 'View Audit Trail', 'System Governance', 'audit-trail', 'system_governance', 'Access the system-wide audit trail module.', 190, FALSE),
    ('71111111-1111-1111-1111-111111111120', 'settings.user.view', 'View Users', 'User Management', 'settings', 'user_management', 'View user management pages and user records.', 200, FALSE),
    ('71111111-1111-1111-1111-111111111121', 'settings.user.create', 'Create Users', 'User Management', 'settings', 'user_management', 'Create new user accounts.', 210, TRUE),
    ('71111111-1111-1111-1111-111111111122', 'settings.user.edit', 'Edit Users', 'User Management', 'settings', 'user_management', 'Edit user account information.', 220, TRUE),
    ('71111111-1111-1111-1111-111111111123', 'settings.user.delete', 'Delete Users', 'User Management', 'settings', 'user_management', 'Delete or deactivate user accounts.', 230, TRUE),
    ('71111111-1111-1111-1111-111111111124', 'settings.user.reset_password', 'Reset Passwords', 'User Management', 'settings', 'user_management', 'Reset another user password.', 240, TRUE),
    ('71111111-1111-1111-1111-111111111125', 'settings.user.force_logout', 'Force Logout Users', 'User Management', 'settings', 'user_management', 'Immediately revoke active sessions for another user.', 250, TRUE),
    ('71111111-1111-1111-1111-111111111126', 'settings.role.view', 'View Access Profiles', 'Access Profiles', 'settings', 'access_profiles', 'View access profiles and global role definitions.', 260, FALSE),
    ('71111111-1111-1111-1111-111111111127', 'settings.role.manage', 'Manage Access Profiles', 'Access Profiles', 'settings', 'access_profiles', 'Create, edit, or deactivate global access profiles.', 270, TRUE),
    ('71111111-1111-1111-1111-111111111128', 'settings.role.assign_permissions', 'Assign Permissions', 'Access Profiles', 'settings', 'access_profiles', 'Assign permission sets to global access profiles.', 280, TRUE),
    ('71111111-1111-1111-1111-111111111129', 'settings.configuration.view', 'View Configuration', 'System Configuration', 'settings', 'system_configuration', 'View system-wide configuration.', 290, FALSE),
    ('71111111-1111-1111-1111-111111111130', 'settings.configuration.edit', 'Edit Configuration', 'System Configuration', 'settings', 'system_configuration', 'Edit system-wide configuration, maintenance, and security settings.', 300, TRUE),
    ('71111111-1111-1111-1111-111111111131', 'my_tasks.module.view', 'View My Tasks', 'Personal Workspace', 'my-tasks', 'personal_workspace', 'Access personal tasks and approvals.', 310, FALSE),
    ('71111111-1111-1111-1111-111111111132', 'notifications.module.view', 'View Notifications', 'Personal Workspace', 'notifications', 'personal_workspace', 'Access in-application notifications.', 320, FALSE),
    ('71111111-1111-1111-1111-111111111133', 'preferences.module.view', 'View Preferences', 'Personal Workspace', 'preferences', 'personal_workspace', 'Open the personal preferences module.', 330, FALSE),
    ('71111111-1111-1111-1111-111111111134', 'preferences.module.edit', 'Edit Preferences', 'Personal Workspace', 'preferences', 'personal_workspace', 'Update personal preferences and self-service settings.', 340, FALSE),
    ('71111111-1111-1111-1111-111111111135', 'help_support.module.view', 'View Help & Support', 'Support Modules', 'help-support', 'support_modules', 'Access help and support resources.', 350, FALSE),
    ('71111111-1111-1111-1111-111111111136', 'user_manual.module.view', 'View User Manual', 'Support Modules', 'user-manual', 'support_modules', 'Access the user manual module.', 360, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    requires_audit = EXCLUDED.requires_audit;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'dashboard.module.view', 'documents.module.view', 'documents.admin.view',
    'documents.admin.manage_workflow_roles', 'documents.admin.manage_sod_constraints',
    'training.module.view', 'training.material.manage',
    'deviations.module.view', 'change_control.module.view', 'capa.module.view',
    'complaints.module.view', 'risk_management.module.view', 'equipment.module.view',
    'supplier.module.view', 'product.module.view', 'regulatory.module.view',
    'report.module.view', 'report.module.export', 'audittrail.module.view',
    'settings.user.view', 'settings.user.create', 'settings.user.edit', 'settings.user.delete',
    'settings.user.reset_password', 'settings.user.force_logout',
    'settings.role.view', 'settings.role.manage', 'settings.role.assign_permissions',
    'settings.configuration.view', 'settings.configuration.edit',
    'my_tasks.module.view', 'notifications.module.view', 'preferences.module.view',
    'preferences.module.edit', 'help_support.module.view', 'user_manual.module.view'
)
WHERE UPPER(r.name) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN')
   OR UPPER(r.code) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'dashboard.module.view', 'documents.module.view', 'documents.admin.view',
    'documents.admin.manage_workflow_roles', 'documents.admin.manage_sod_constraints',
    'training.module.view', 'report.module.view', 'report.module.export',
    'audittrail.module.view', 'my_tasks.module.view', 'notifications.module.view',
    'preferences.module.view', 'preferences.module.edit', 'help_support.module.view',
    'user_manual.module.view'
)
WHERE UPPER(r.name) = 'DCO' OR UPPER(r.code) = 'DCO'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'dashboard.module.view', 'documents.module.view', 'training.module.view',
    'my_tasks.module.view', 'notifications.module.view', 'preferences.module.view',
    'preferences.module.edit', 'help_support.module.view', 'user_manual.module.view'
)
WHERE UPPER(r.name) IN ('USER', 'STANDARD USER', 'VIEWER', 'VIEWER/OPERATOR')
   OR UPPER(r.code) IN ('USER', 'VIEWER', 'VIEWER_OPERATOR')
ON CONFLICT DO NOTHING;
