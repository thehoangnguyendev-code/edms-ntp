-- Make Access Profile -> Permission Set -> Permission the only effective grant path.
-- Legacy role_permissions are copied into a managed Permission Set per existing role;
-- active users without an Access Profile are then assigned to their matching role.

INSERT INTO permission_sets (id, code, name, description, active, system)
SELECT
    gen_random_uuid(),
    'ROLE_' || r.code,
    r.name || ' managed permissions',
    'System-managed compatibility set created from the legacy permissions of role ' || r.code || '.',
    TRUE,
    TRUE
FROM roles r
WHERE EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM permission_sets ps WHERE ps.code = 'ROLE_' || r.code);

INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, rp.permission_id
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permission_sets ps ON ps.code = 'ROLE_' || r.code
WHERE NOT EXISTS (
    SELECT 1
    FROM permission_set_items existing
    WHERE existing.permission_set_id = ps.id
      AND existing.permission_id = rp.permission_id
);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now()
FROM roles r
JOIN permission_sets ps ON ps.code = 'ROLE_' || r.code
WHERE EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id)
  AND NOT EXISTS (
      SELECT 1
      FROM access_profile_permission_sets existing
      WHERE existing.access_profile_id = r.id
        AND existing.permission_set_id = ps.id
  );

-- Only Active users are backfilled. Suspended, inactive, pending, and terminated
-- accounts remain untouched and cannot regain access through this migration.
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN roles r
  ON lower(trim(r.code)) = lower(trim(u.role_name))
  OR lower(trim(r.name)) = lower(trim(u.role_name))
WHERE lower(u.status::text) = 'active'
  AND r.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM user_access_profiles existing
      WHERE existing.user_id = u.id
  )
  AND EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id);

-- A non-super-admin Active user must now be represented by at least one
-- Access Profile. This index makes orphan reporting fast for operational checks.
CREATE INDEX IF NOT EXISTS idx_uap_user_profile ON user_access_profiles (user_id, access_profile_id);
