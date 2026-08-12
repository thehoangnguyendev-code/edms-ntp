-- Normalize legacy Obsolete labels to Obsoleted across canonical status lookups and seeded data.

UPDATE document_statuses
SET label = 'Obsoleted',
    updated_at = NOW()
WHERE code = 'OBSOLETED'
  AND label <> 'Obsoleted';

UPDATE revision_statuses
SET label = 'Obsoleted',
    updated_at = NOW()
WHERE code = 'OBSOLETED'
  AND label <> 'Obsoleted';

UPDATE controlled_copy_statuses
SET label = 'Obsoleted',
    updated_at = NOW()
WHERE code = 'OBSOLETE'
  AND label <> 'Obsoleted';

UPDATE controlled_copies
SET status = 'Obsoleted',
    updated_at = NOW()
WHERE UPPER(COALESCE(status, '')) = 'OBSOLETE'
  AND status <> 'Obsoleted';
