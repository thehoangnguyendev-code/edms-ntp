-- Keep controlled copy status labels consistent across current DB data.
-- This migration is additive so it does not alter any previously applied migration checksums.

UPDATE controlled_copy_statuses
SET label = 'Obsoleted',
    updated_at = NOW()
WHERE code = 'OBSOLETE'
  AND label <> 'Obsoleted';

UPDATE controlled_copies
SET status = 'Obsoleted',
    updated_at = NOW()
WHERE status_code = 'OBSOLETE'
  AND status <> 'Obsoleted';

UPDATE controlled_copy_distribution_batches
SET status = 'Obsoleted',
    updated_at = NOW()
WHERE status_code = 'OBSOLETE'
  AND status <> 'Obsoleted';
