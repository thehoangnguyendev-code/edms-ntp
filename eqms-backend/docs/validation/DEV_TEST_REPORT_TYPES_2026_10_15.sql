-- DEV test only (2026-10-15, REPORT-PLATFORM-2026-10-15 phases 1 and 2): the Report Author test permission set also holds the two Report Types permissions and the two
-- Audit Trail permissions, so that the test account admin can open Report Types and use the Audit Trail type. Idempotent.
-- Restart the backend afterwards: permissions are cached.
BEGIN;
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('reports.types.view', 'reports.types.manage', 'audit.view', 'audit.export')
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
COMMIT;
