-- V166: Backfill users from legacy role_name into user_access_profiles
-- (RBAC master plan section 18.2 step 2). V154 already backfilled super admins;
-- this covers every remaining user whose role_name matches an active role
-- (by name or code, case-insensitive) and who has no access profile yet.
-- Idempotent: NOT EXISTS + ON CONFLICT DO NOTHING.

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now()
FROM app_users u
JOIN LATERAL (
    SELECT r.id
    FROM roles r
    WHERE r.is_active = true
      AND (LOWER(TRIM(r.name)) = LOWER(TRIM(u.role_name))
           OR LOWER(TRIM(COALESCE(r.code, ''))) = LOWER(TRIM(u.role_name)))
    ORDER BY r.created_at NULLS LAST
    LIMIT 1
) r ON true
WHERE u.role_name IS NOT NULL
  AND TRIM(u.role_name) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM user_access_profiles uap WHERE uap.user_id = u.id
  )
ON CONFLICT DO NOTHING;
