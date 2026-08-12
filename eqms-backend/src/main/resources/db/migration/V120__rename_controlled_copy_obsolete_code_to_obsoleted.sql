-- Rename the controlled copy status code from OBSOLETE to OBSOLETED.
-- The database already stores the user-facing label as "Obsoleted",
-- so we only normalize the internal code and any persisted rows.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM controlled_copy_statuses WHERE code = 'OBSOLETE')
       AND NOT EXISTS (SELECT 1 FROM controlled_copy_statuses WHERE code = 'OBSOLETED') THEN
        UPDATE controlled_copy_statuses
        SET code = 'OBSOLETED',
            label = 'Obsoleted',
            updated_at = NOW()
        WHERE code = 'OBSOLETE';
    END IF;
END $$;

UPDATE controlled_copies
SET status_code = 'OBSOLETED',
    status = 'Obsoleted'
WHERE UPPER(COALESCE(status_code, '')) = 'OBSOLETE'
   OR UPPER(COALESCE(status, '')) = 'OBSOLETE';

UPDATE controlled_copy_distribution_batches
SET status_code = 'OBSOLETED',
    status = 'Obsoleted'
WHERE UPPER(COALESCE(status_code, '')) = 'OBSOLETE'
   OR UPPER(COALESCE(status, '')) = 'OBSOLETE';

DELETE FROM controlled_copy_statuses
WHERE code = 'OBSOLETE'
  AND NOT EXISTS (
      SELECT 1
      FROM controlled_copies
      WHERE status_code = 'OBSOLETE'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM controlled_copy_distribution_batches
      WHERE status_code = 'OBSOLETE'
  );
