-- V154: Seed canonical SYSTEM_SUPER_ADMIN access profile and backfill legacy super admin users.
--
-- Context (Sprint 1 Security Kernel Retrofit):
--   EffectivePermissionService grants super admin ONLY when a user has a UserAccessProfile
--   that points to a RoleDefinition with code = 'SYSTEM_SUPER_ADMIN'.
--   Without this migration, existing users whose role_name is 'SUPERADMIN' / 'admin' /
--   'administrator' would lose their isSuperAdmin() capability flag because
--   app.security.legacy-super-admin-aliases-enabled is false by default.
--
-- What this migration does:
--   1. Inserts the SYSTEM_SUPER_ADMIN RoleDefinition into `roles` (idempotent).
--   2. Assigns any existing user whose role_name is a legacy super-admin alias to the new
--      SYSTEM_SUPER_ADMIN access profile in `user_access_profiles` (idempotent via ON CONFLICT).
--
-- What this migration does NOT do:
--   - Does not remove role_name from app_users (legacy fallback stays intact).
--   - Does not grant any explicit permission codes (super admin bypasses permission checks).
--   - Does not touch any other role definitions or permission sets.
--
-- Rollback (if needed):
--   DELETE FROM user_access_profiles
--   WHERE access_profile_id = (SELECT id FROM roles WHERE code = 'SYSTEM_SUPER_ADMIN');
--   DELETE FROM roles WHERE code = 'SYSTEM_SUPER_ADMIN';

-- ── Step 1: Insert SYSTEM_SUPER_ADMIN role definition ────────────────────────

INSERT INTO roles (id, code, name, description, is_system, is_active, type, created_at, updated_at)
SELECT
    '41111111-1111-1111-1111-111111111121',
    'SYSTEM_SUPER_ADMIN',
    'System Super Admin',
    'Canonical super admin access profile. Grants full system access via EffectivePermissionService. '
        || 'Assigned to users who previously held legacy super-admin role names.',
    TRUE,
    TRUE,
    'SYSTEM',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE code = 'SYSTEM_SUPER_ADMIN'
       OR name = 'System Super Admin'
);

-- ── Step 2: Backfill user_access_profiles for legacy super-admin users ────────
--
-- Covers: SUPERADMIN, SuperAdmin, superadmin, ADMIN, Administrator, admin
-- (matches EffectivePermissionService.isLegacySuperAdminRoleName() alias list)
--
-- assigned_by = NULL because this is an automated migration, not a human assignment.

INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at, assigned_by)
SELECT
    u.id                                                     AS user_id,
    r.id                                                     AS access_profile_id,
    NOW()                                                    AS assigned_at,
    NULL                                                     AS assigned_by
FROM app_users u
CROSS JOIN (
    SELECT id FROM roles WHERE code = 'SYSTEM_SUPER_ADMIN'
) r
WHERE LOWER(TRIM(u.role_name)) IN ('superadmin', 'admin', 'administrator')
  AND u.id IS NOT NULL
ON CONFLICT (user_id, access_profile_id) DO NOTHING;
