-- V78: Standardize Controlled Copy status label for OBSOLETE state to 'Obsoleted'
UPDATE controlled_copy_statuses
SET label = 'Obsoleted',
    updated_at = NOW()
WHERE code = 'OBSOLETE';

UPDATE controlled_copies
SET status = 'Obsoleted',
    updated_at = NOW()
WHERE status_code = 'OBSOLETE'
  AND status != 'Obsoleted';
