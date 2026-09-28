-- Consolidate the two overlapping "admin" access profiles (ADMINISTRATOR, SYSTEM_SUPER_ADMIN)
-- into ADMINISTRATOR. SYSTEM_SUPER_ADMIN was previously kept separate as a code-identified
-- break-glass identity (self-lockout guard, maintenance-mode bypass, self-grant-critical-
-- permission exemption -- see AccessProfileService/SystemConfigurationService/AuthTokenFilter),
-- but per decision, those hardcoded identity checks are being replaced with equivalent
-- permission-based checks in application code, so a second profile is no longer needed.

-- 1) Give ADMINISTRATOR everything SYSTEM_ADMINISTRATION grants (incl. security.maintenance.bypass,
--    which ROLE_ADMINISTRATOR alone did not have) so no capability is lost in the merge.
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT a.id, ps.id, NOW()
FROM roles a, permission_sets ps
WHERE a.code = 'ADMINISTRATOR' AND ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT DO NOTHING;

-- 2) Drop the stray UAT/test permission set that had no business being on the real admin profile.
DELETE FROM access_profile_permission_sets
WHERE access_profile_id = (SELECT id FROM roles WHERE code = 'ADMINISTRATOR')
  AND permission_set_id = (SELECT id FROM permission_sets WHERE code = 'PS_UAT_CONTROLLED_COPY_REQUESTER');

-- 3) Move every user off SYSTEM_SUPER_ADMIN onto ADMINISTRATOR.
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT uap.user_id, a.id, NOW()
FROM user_access_profiles uap
JOIN roles s ON s.id = uap.access_profile_id AND s.code = 'SYSTEM_SUPER_ADMIN'
CROSS JOIN (SELECT id FROM roles WHERE code = 'ADMINISTRATOR') a
ON CONFLICT DO NOTHING;

-- 4) Remove the now-redundant profile. Cascades clean up its permission-set links and the
--    user assignments moved in step 3.
DELETE FROM roles WHERE code = 'SYSTEM_SUPER_ADMIN';
