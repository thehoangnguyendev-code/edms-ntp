-- Access Profiles are the sole runtime authorization source.
-- Preserve app_users.role_name for historical audit compatibility, but replace values for
-- accounts already assigned an Access Profile with a neutral technical marker. Runtime code
-- must not authorize from this column.
UPDATE app_users u
SET role_name = 'ACCESS_PROFILE_MANAGED'
WHERE u.role_name IS DISTINCT FROM 'ACCESS_PROFILE_MANAGED'
  AND EXISTS (
      SELECT 1
      FROM user_access_profiles uap
      WHERE uap.user_id = u.id
  );
