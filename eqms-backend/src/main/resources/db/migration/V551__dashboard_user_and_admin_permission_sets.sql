-- V551: two Permission Sets for the dashboards -- one for the user (personal) dashboard, one for the administrative one.
--
-- Owner decisions (DASHBOARD-PERMISSION-SETS-2026-10-07 in docs/governance/DECISION_LOG.md):
--   * the sets bundle the permissions that already exist; no permission is added and no enforcement changes
--     (the user dashboard stays gated by dashboard.module.view, the administrative one by dashboard.admin.view,
--     which V403 records as REQUIRING dashboard.module.view);
--   * the sets are only created. They are NOT assigned to any Access Profile here, so nobody gains or loses a
--     permission: an Administrator assigns them in Access Profiles when and where they want to.
--
-- Idempotent: a set or item that already exists is left as it is.

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), v.name, v.code, v.description, true, false
FROM (VALUES
    ('Dashboard User',  'DASHBOARD_USER',
     'Opens the user (personal) dashboard: workflow and library totals, the user''s own pending work and documents, and effective documents by type.'),
    ('Dashboard Admin', 'DASHBOARD_ADMIN',
     'Opens the administrative dashboard: user, document and revision statistics, audit activity, and everything the user dashboard shows.')
) AS v(name, code, description)
WHERE NOT EXISTS (SELECT 1 FROM permission_sets existing WHERE existing.code = v.code);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('DASHBOARD_USER',  'dashboard.module.view'),
    ('DASHBOARD_ADMIN', 'dashboard.module.view'),
    ('DASHBOARD_ADMIN', 'dashboard.admin.view')
) AS v(set_code, permission_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id
);
