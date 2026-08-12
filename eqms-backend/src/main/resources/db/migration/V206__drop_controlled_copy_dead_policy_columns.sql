-- Removes 2 dead policy settings confirmed never enforced by any backend code path:
-- default_distribution_method (no corresponding concept anywhere on ControlledCopyRecord),
-- allow_print (the "Mark as Printed" action it gated is unreachable from the UI and is
-- being removed alongside this migration).
ALTER TABLE controlled_copy_policy_settings
    DROP COLUMN default_distribution_method,
    DROP COLUMN allow_print;
