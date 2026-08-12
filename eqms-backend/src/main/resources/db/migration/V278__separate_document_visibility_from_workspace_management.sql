-- Separate document-wide visibility from Document Control operations.
-- A DCO can read every document/revision, but read access must never imply
-- permission to edit another Author's Draft or to administer system security.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT v.id, v.code, v.name, v.category, v.module_key, v.group_key, v.description, v.display_order, v.requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111278'::uuid, 'documents.document.view_all',
        'View All Document Records', 'Document Master', 'documents', 'document_control_access',
        'View all document masters and revisions regardless of ownership, workflow participation, business unit, or department. This permission is read-only.', 778, FALSE),
    ('72111111-1111-1111-1111-111111111279'::uuid, 'documents.workspace.manage',
        'Manage Document Control Workspace', 'Document Control', 'documents', 'document_control_access',
        'Perform operational Document Control actions allowed by lifecycle and workflow policy. It does not permit editing another Author''s Draft source or content.', 779, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- DCO and Document Admin receive the two explicit Document Control permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('documents.document.view_all', 'documents.workspace.manage')
WHERE UPPER(COALESCE(r.code, '')) IN ('DCO', 'DOCUMENT_ADMIN', 'DOCUMENT_CONTROL_OFFICER', 'DOCUMENT_CONTROL_ADMIN', 'SYSTEM_SUPER_ADMIN', 'ADMINISTRATOR')
ON CONFLICT DO NOTHING;

-- Keep the lifecycle test DCO aligned with the production policy.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('documents.document.view_all', 'documents.workspace.manage')
WHERE ps.code = 'PS_DCO_TEST'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id
  );

-- DCO is a Document Control role, not a system-security administrator. Remove
-- unrelated administration grants from the built-in DCO role; Administrator
-- remains the owner of user/role/security/system-configuration administration.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND UPPER(COALESCE(r.code, '')) = 'DCO'
  AND p.code IN (
      'dashboard.admin.view',
      'documents.admin.view', 'documents.admin.manage_workflow_roles', 'documents.admin.manage_sod_constraints',
      'training.module.view', 'training.material.manage',
      'settings.configuration.view', 'settings.configuration.edit',
      'settings.user.view', 'settings.user.create', 'settings.user.edit', 'settings.user.delete',
      'settings.user.reset_password', 'settings.user.force_logout',
      'settings.role.view', 'settings.role.manage', 'settings.role.assign_permissions',
      'security.permission_sets.view', 'security.permission_sets.update',
      'security.access_profiles.view', 'security.access_profiles.update', 'security.access_profiles.assign',
      'security.workflow_authorization.view', 'security.workflow_authorization.manage',
      'security.object_rules.view', 'security.object_rules.manage', 'security.sod.view', 'security.sod.manage',
      'settings.dictionary.view', 'settings.dictionary.manage'
  );
