-- Publishing Templates management (Open Template Editor from the Publishing Workspace) is
-- gated by the generic settings.configuration.view/edit permissions (no dedicated
-- publishing-template permission exists in the catalog yet). DCO_LEGACY already has both,
-- confirming DCO is the intended operator of this screen, but PS_DCO_TEST (the new Access
-- Profile catalog test role) was missing the grant.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('settings.configuration.view', 'settings.configuration.edit')
WHERE ps.code = 'PS_DCO_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
