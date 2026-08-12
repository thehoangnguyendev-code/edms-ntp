DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name
      INTO constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = current_schema()
       AND tc.table_name = 'controlled_copy_distribution_batches'
       AND tc.constraint_type = 'UNIQUE'
       AND kcu.column_name = 'batch_number'
     LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE controlled_copy_distribution_batches DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_batch_number
    ON controlled_copy_distribution_batches(batch_number);
