-- Grant PS_DCO_TEST the Access Profile view permission so the "View Effective Access"
-- diagnostic screen can be exercised end-to-end by a test account without resorting to the
-- SuperAdmin login. Mirrors the DCO_LEGACY permission set, which already has this permission.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'security.access_profiles.view'
WHERE ps.code = 'PS_DCO_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
