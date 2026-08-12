-- Keep the frontend route/menu checks enabled. Grant these self-service permissions to every access profile.
INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Baseline Personal Workspace', 'BASELINE_PERSONAL_WORKSPACE',
       'Required self-service access to Dashboard, Notifications, Preferences, and Help & Support for every user.',
       true, true
WHERE NOT EXISTS (SELECT 1 FROM permission_sets WHERE code = 'BASELINE_PERSONAL_WORKSPACE');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN (
    'dashboard.module.view', 'notifications.module.view',
    'preferences.module.view', 'preferences.module.edit',
    'help_support.module.view', 'user_manual.module.view'
)
WHERE ps.code = 'BASELINE_PERSONAL_WORKSPACE'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id
  );

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT role.id, ps.id, CURRENT_TIMESTAMP
FROM roles role
JOIN permission_sets ps ON ps.code = 'BASELINE_PERSONAL_WORKSPACE'
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets existing
    WHERE existing.access_profile_id = role.id AND existing.permission_set_id = ps.id
);
