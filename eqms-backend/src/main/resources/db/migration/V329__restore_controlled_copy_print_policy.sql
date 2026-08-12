-- Controlled-copy printing is policy controlled.  This was removed by the
-- historical dead-policy cleanup and is restored as an active setting.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS allow_print BOOLEAN NOT NULL DEFAULT FALSE;
