-- DEV test only (2026-10-18, owner decision in the session): the three paper permissions of Training Management are held by the test permission set that already holds every
-- training.* permission (see DEV_TEST_TRAINING_PERMISSIONS_2026_10_16.sql), so that admin, approver.test1 and user.a.test can type results from paper and check them (two different
-- people). The V616 and V617 migrations grant these permissions to nobody on purpose. Idempotent. Restart the backend afterwards: permissions are cached. DEV data only.
BEGIN;
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('training.paper.print', 'training.paper.transcribe', 'training.paper.verify')
WHERE ps.code = 'PS_REPORT_AUTHOR_DEV_TEST'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
COMMIT;
