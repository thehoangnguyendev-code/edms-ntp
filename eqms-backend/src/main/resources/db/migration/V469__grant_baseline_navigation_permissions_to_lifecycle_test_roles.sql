-- The 5 lifecycle-test Permission Sets seeded by V179 (PS_DCO_TEST, PS_AUTHOR_TEST,
-- PS_COAUTHOR_TEST, PS_REVIEWER_TEST, PS_APPROVER_TEST) only ever granted document-specific
-- permissions. Every user's default landing page is Dashboard (app_users.home_page defaults
-- to 'DASHBOARD'), which requires dashboard.module.view -- without it, a fresh login lands on
-- an "Access Denied" page and the sidebar renders empty, even though the user does have
-- documents.module.view and could use Document Control once there. Add the baseline
-- navigation permissions every real user has (Dashboard + Notifications) so these test
-- accounts land on a working screen immediately after login.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('PS_DCO_TEST', 'dashboard.module.view'),
    ('PS_DCO_TEST', 'notifications.module.view'),
    ('PS_AUTHOR_TEST', 'dashboard.module.view'),
    ('PS_AUTHOR_TEST', 'notifications.module.view'),
    ('PS_COAUTHOR_TEST', 'dashboard.module.view'),
    ('PS_COAUTHOR_TEST', 'notifications.module.view'),
    ('PS_REVIEWER_TEST', 'dashboard.module.view'),
    ('PS_REVIEWER_TEST', 'notifications.module.view'),
    ('PS_APPROVER_TEST', 'dashboard.module.view'),
    ('PS_APPROVER_TEST', 'notifications.module.view')
) AS v(ps_code, permission_code)
JOIN permission_sets ps ON ps.code = v.ps_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
