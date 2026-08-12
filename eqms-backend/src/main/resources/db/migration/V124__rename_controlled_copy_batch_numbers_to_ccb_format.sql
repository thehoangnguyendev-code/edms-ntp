WITH ranked_batches AS (
    SELECT
        id,
        'CCB.'
            || trim(BOTH '.' FROM regexp_replace(trim(document_number), '[^A-Za-z0-9]+', '.', 'g'))
            || '.B'
            || lpad(
                row_number() OVER (
                    PARTITION BY document_id
                    ORDER BY COALESCE(requested_at, created_at), id
                )::TEXT,
                3,
                '0'
            ) AS next_batch_number
    FROM controlled_copy_distribution_batches
)
UPDATE controlled_copy_distribution_batches target
   SET batch_number = ranked_batches.next_batch_number
  FROM ranked_batches
 WHERE target.id = ranked_batches.id
   AND target.batch_number IS DISTINCT FROM ranked_batches.next_batch_number;
