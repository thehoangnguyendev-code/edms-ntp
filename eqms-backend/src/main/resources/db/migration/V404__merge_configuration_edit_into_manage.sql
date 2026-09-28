-- Consolidates settings.configuration.edit into settings.configuration.manage (product decision,
-- 2026-08-27): the two codes were functionally identical write-permissions on the same
-- "settings.configuration.view" pairing (every OR-check in code already accepted either), and
-- .manage is the naming convention used by every sibling settings.* write permission
-- (dictionary.manage, controlled_copy_policy.manage, publishing_template.manage,
-- notification_policy.manage) -- .edit was the odd one out. Kept .manage because it already had
-- an assignment (the "Settings Manager" permission set) that .edit did not have.

-- Reassign permission set / role grants from .edit to .manage, skipping rows that would duplicate
-- an existing .manage grant (e.g. "Administrator managed permissions" already has both).
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT psi.permission_set_id, (SELECT id FROM permissions WHERE code = 'settings.configuration.manage')
FROM permission_set_items psi
JOIN permissions p ON p.id = psi.permission_id
WHERE p.code = 'settings.configuration.edit'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, (SELECT id FROM permissions WHERE code = 'settings.configuration.manage')
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code = 'settings.configuration.edit'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Cascades away the now-orphaned permission_set_items/role_permissions rows for .edit, and the
-- permission_dependencies row (settings.configuration.edit REQUIRES settings.configuration.view,
-- SET-07/08) since permission_code has ON DELETE CASCADE.
DELETE FROM permissions WHERE code = 'settings.configuration.edit';

-- Re-seed the REQUIRES rule under the surviving code so the dependency catalog keeps the same
-- guarantee ("manage" still requires "view"), consistent with every sibling settings.* pair.
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES ('settings.configuration.manage', 'settings.configuration.view', 'REQUIRES', 'SET-07/08',
        'Sửa cấu hình cần xem được cấu hình trước.')
ON CONFLICT DO NOTHING;
