-- V179's test roles missed two functional dependencies discovered during live testing:
-- 1. dashboard.module.view — the post-login landing route is /dashboard, which is
--    permission-gated; without it every test user lands on "Access Denied".
-- 2. settings.user.view (DCO only) — the New Document screen loads the user list
--    to populate the Author/Co-Author/Reviewer/Approver pickers; without it the
--    load fails (previously with a stealth-logout due to the 401-vs-403 bug fixed
--    alongside this migration).

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'dashboard.module.view'),
    ('PS_DCO_TEST', 'settings.user.view'),
    ('PS_AUTHOR_TEST', 'dashboard.module.view'),
    ('PS_COAUTHOR_TEST', 'dashboard.module.view'),
    ('PS_REVIEWER_TEST', 'dashboard.module.view'),
    ('PS_APPROVER_TEST', 'dashboard.module.view')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
