-- Controlled Copy expiry is a policy snapshot taken when the request is created.
-- Older rows were created before the expiry-duration policy was enforced and may have
-- a null expiry_date. Backfill those rows once so list/detail screens and the scheduler
-- have a consistent value; this does not change rows that already have an expiry.

-- Prefer the batch snapshot for child records. This keeps every record in a batch
-- aligned with the policy value captured at request time.
UPDATE controlled_copies c
SET has_expiry_date = TRUE,
    expiry_date = b.expiry_date
FROM controlled_copy_distribution_batches b
WHERE c.distribution_batch_id = b.id
  AND c.expiry_date IS NULL
  AND b.expiry_date IS NOT NULL;

-- Remaining legacy rows use the active global policy. If a legacy database does not
-- contain the system row, the documented default of 30 days is used as a safe fallback.
WITH global_policy AS (
    SELECT COALESCE(MIN(max_duration_days), 30)::double precision AS duration_days
    FROM controlled_copy_expiry_limits
    WHERE active = TRUE
      AND document_type_id IS NULL
      AND department_id IS NULL
), candidates AS (
    SELECT c.id,
           COALESCE(c.requested_at, c.created_at, CURRENT_TIMESTAMP)
             + (global_policy.duration_days * INTERVAL '1 day') AS calculated_expiry
    FROM controlled_copies c
    CROSS JOIN global_policy
    WHERE c.expiry_date IS NULL
)
UPDATE controlled_copies c
SET has_expiry_date = TRUE,
    expiry_date = candidates.calculated_expiry
FROM candidates
WHERE c.id = candidates.id;

UPDATE controlled_copy_distribution_batches b
SET has_expiry_date = TRUE,
    expiry_date = COALESCE(
        b.expiry_date,
        COALESCE(b.requested_at, b.created_at, CURRENT_TIMESTAMP)
          + (COALESCE((
                SELECT MIN(l.max_duration_days)::double precision
                FROM controlled_copy_expiry_limits l
                WHERE l.active = TRUE
                  AND l.document_type_id IS NULL
                  AND l.department_id IS NULL
            ), 30) * INTERVAL '1 day')
    )
WHERE b.expiry_date IS NULL;
