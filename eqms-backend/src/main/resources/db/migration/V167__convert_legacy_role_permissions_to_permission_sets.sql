-- V167: Convert legacy role_permissions into Permission Sets attached to Access Profiles.
-- V166 backfilled users into user_access_profiles, but profiles carried no permission
-- sets, so users resolved ZERO permissions under the Access Profile model (Step 2)
-- while the legacy role_permissions grants were ignored. This migration creates one
-- "<Role> (Legacy)" permission set per role that has role_permissions but no
-- assigned permission set, and links it to the profile. Idempotent.

-- 1. Create legacy permission sets for roles that need them
INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(),
       r.name || ' (Legacy)',
       COALESCE(NULLIF(TRIM(r.code), ''), UPPER(REPLACE(r.name, ' ', '_'))) || '_LEGACY',
       'Auto-generated from legacy role permissions during Access Profile migration (V167).',
       true,
       false
FROM roles r
WHERE EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets aps WHERE aps.access_profile_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM permission_sets ps
                  WHERE ps.code = COALESCE(NULLIF(TRIM(r.code), ''), UPPER(REPLACE(r.name, ' ', '_'))) || '_LEGACY');

-- 2. Fill the legacy sets with the role's legacy permissions
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, rp.permission_id
FROM roles r
JOIN permission_sets ps
  ON ps.code = COALESCE(NULLIF(TRIM(r.code), ''), UPPER(REPLACE(r.name, ' ', '_'))) || '_LEGACY'
JOIN role_permissions rp ON rp.role_id = r.id
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = rp.permission_id
);

-- 3. Attach each legacy set to its access profile (role)
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT r.id, ps.id, now()
FROM roles r
JOIN permission_sets ps
  ON ps.code = COALESCE(NULLIF(TRIM(r.code), ''), UPPER(REPLACE(r.name, ' ', '_'))) || '_LEGACY'
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets aps
    WHERE aps.access_profile_id = r.id AND aps.permission_set_id = ps.id
)
ON CONFLICT DO NOTHING;
