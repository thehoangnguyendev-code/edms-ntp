-- Merge the global "default expiry" concept into controlled_copy_expiry_limits as a single
-- mandatory, non-deletable system row (document_type_id/department_id both NULL). Every Controlled
-- Copy now always has an expiry date resolved from this table (most specific rule wins), so the
-- separate expiry fields on controlled_copy_policy_settings are no longer needed.

INSERT INTO controlled_copy_expiry_limits (document_type_id, department_id, max_duration_days, active, is_system, description)
SELECT NULL, NULL, 30, TRUE, TRUE, 'Global Default'
WHERE NOT EXISTS (
    SELECT 1 FROM controlled_copy_expiry_limits WHERE document_type_id IS NULL AND department_id IS NULL
);

ALTER TABLE controlled_copy_policy_settings
    DROP COLUMN default_expiry_policy,
    DROP COLUMN requester_may_override,
    DROP COLUMN expiry_required,
    DROP COLUMN max_expiry_duration_days;
