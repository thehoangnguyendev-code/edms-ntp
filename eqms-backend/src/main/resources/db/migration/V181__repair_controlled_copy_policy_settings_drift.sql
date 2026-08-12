-- Live DB drifted from the V148 contract (changed outside Flyway — no migration
-- touches these):
--   1. approver_user was tightened to NOT NULL DEFAULT '' (V148/entity say nullable),
--   2. the singleton row's id is not the DEFAULT_ID the entity looks up
--      ('00000000-0000-0000-0000-000000000201').
-- Consequence: ControlledCopyPolicyService.loadOrDefault() misses the row and tries
-- to INSERT a fresh default with approver_user NULL -> NOT NULL violation -> every
-- document save that evaluates controlled-copy capabilities fails with
-- "Unable to save data because it violates database constraints".

ALTER TABLE controlled_copy_policy_settings ALTER COLUMN approver_user DROP NOT NULL;
ALTER TABLE controlled_copy_policy_settings ALTER COLUMN approver_user DROP DEFAULT;

-- Re-point the existing (possibly admin-configured) singleton row to the id the
-- entity expects, preserving its values. Only fires when the expected row is absent.
UPDATE controlled_copy_policy_settings
SET id = '00000000-0000-0000-0000-000000000201'
WHERE id = (
    SELECT id FROM controlled_copy_policy_settings
    WHERE id <> '00000000-0000-0000-0000-000000000201'
    ORDER BY updated_at DESC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM controlled_copy_policy_settings
    WHERE id = '00000000-0000-0000-0000-000000000201'
);

-- Empty-string approver_user (from the drifted DEFAULT '') means "not set" — normalize.
UPDATE controlled_copy_policy_settings SET approver_user = NULL WHERE approver_user = '';
