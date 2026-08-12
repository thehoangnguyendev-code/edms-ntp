ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS distribution_comment TEXT;
