ALTER TABLE controlled_copy_distribution_batches
    ADD COLUMN IF NOT EXISTS distribution_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS external_recipients TEXT;

ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS distribution_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS external_recipients TEXT;

UPDATE controlled_copy_distribution_batches
SET distribution_mode = COALESCE(distribution_mode, CASE
    WHEN external_recipients IS NOT NULL AND TRIM(external_recipients) <> '' THEN 'EXTERNAL'
    WHEN distribution_scope IS NOT NULL OR distribution_list IS NOT NULL THEN 'INTERNAL'
    ELSE distribution_mode
END);

UPDATE controlled_copies
SET distribution_mode = COALESCE(distribution_mode, CASE
    WHEN external_recipients IS NOT NULL AND TRIM(external_recipients) <> '' THEN 'EXTERNAL'
    WHEN distribution_scope IS NOT NULL OR distribution_list IS NOT NULL THEN 'INTERNAL'
    ELSE distribution_mode
END);

CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_mode ON controlled_copy_distribution_batches(distribution_mode);
CREATE INDEX IF NOT EXISTS idx_controlled_copies_distribution_mode ON controlled_copies(distribution_mode);
