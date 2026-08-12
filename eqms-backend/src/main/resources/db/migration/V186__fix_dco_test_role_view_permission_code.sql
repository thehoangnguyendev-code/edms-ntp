-- V185 granted PS_DCO_TEST the permission code "security.access_profiles.view", but
-- AccessProfileService.requireView() (the actual gate on GET /security/access-profiles/**,
-- including /effective-access) checks "settings.role.view" directly. "security.access_profiles.view"
-- is only used as an alias key inside PermissionEvaluationService's alias map (resolved the other
-- direction), so granting it directly as a permission_set_item does not satisfy the real check.
-- Grant the actual permission the code checks.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'settings.role.view'
WHERE ps.code = 'PS_DCO_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
