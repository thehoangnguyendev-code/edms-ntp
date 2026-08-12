ALTER TABLE controlled_copy_distribution_batches
    ADD COLUMN IF NOT EXISTS recall_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS recall_reason TEXT;

UPDATE controlled_copy_distribution_batches batch
SET recall_date = source.recall_date,
    recall_reason = source.recall_reason
FROM (
    SELECT DISTINCT ON (distribution_batch_id)
        distribution_batch_id,
        COALESCE(recalled_at, obsoleted_at) AS recall_date,
        recall_reason
    FROM controlled_copies
    WHERE distribution_batch_id IS NOT NULL
      AND status_code = 'OBSOLETED'
    ORDER BY distribution_batch_id, COALESCE(recalled_at, obsoleted_at) DESC NULLS LAST
) source
WHERE batch.id = source.distribution_batch_id
  AND batch.status_code = 'OBSOLETED'
  AND batch.recall_date IS NULL;
