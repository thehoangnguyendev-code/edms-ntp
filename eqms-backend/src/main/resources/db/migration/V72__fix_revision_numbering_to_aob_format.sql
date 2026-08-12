-- V72: Enforce the A.0.B revision numbering scheme across all tables.
-- Rules:
--   Effective/Obsoleted revisions must end in .0  → A.0.0
--   Non-effective revisions must end in .N where N>0 → A.0.N
--   Middle number must always be 0

-- ─── 1. Fix document_revisions where middle part ≠ 0 ─────────────────────────
-- E.g. "0.1.0" (from V71 bad normalization of old "0.1" seed data)
-- For EFFECTIVE/OBSOLETED: → A.0.0
-- For others: → A.0.GREATEST(C, B, 1) where B=old-middle, C=old-patch
UPDATE document_revisions
SET
    revision_number =
        SPLIT_PART(revision_number, '.', 1) || '.0.' ||
        CASE
            WHEN status_code IN ('EFFECTIVE', 'OBSOLETED') THEN '0'
            ELSE GREATEST(
                CASE WHEN SPLIT_PART(revision_number, '.', 3) ~ '^[0-9]+$'
                     THEN SPLIT_PART(revision_number, '.', 3)::integer ELSE 0 END,
                CASE WHEN SPLIT_PART(revision_number, '.', 2) ~ '^[0-9]+$'
                     THEN SPLIT_PART(revision_number, '.', 2)::integer ELSE 0 END,
                1
            )::text
        END,
    updated_at = NOW()
WHERE revision_number IS NOT NULL
  AND revision_number ~ '^\d+\.\d+\.\d+$'
  AND SPLIT_PART(revision_number, '.', 2) != '0';

-- ─── 2. Fix EFFECTIVE/OBSOLETED revisions that don't end in .0 ───────────────
UPDATE document_revisions
SET
    revision_number = SPLIT_PART(revision_number, '.', 1) || '.0.0',
    updated_at = NOW()
WHERE revision_number IS NOT NULL
  AND revision_number ~ '^\d+\.0\.\d+$'
  AND status_code IN ('EFFECTIVE', 'OBSOLETED')
  AND SPLIT_PART(revision_number, '.', 3) != '0';

-- ─── 3. Fix non-terminal revisions (DRAFT/PENDING_*) that end in .0 → .1 ──────
UPDATE document_revisions
SET
    revision_number = SPLIT_PART(revision_number, '.', 1) || '.0.1',
    updated_at = NOW()
WHERE revision_number IS NOT NULL
  AND revision_number ~ '^\d+\.0\.0$'
  AND status_code NOT IN ('EFFECTIVE', 'OBSOLETED', 'CLOSED_CANCELLED');

-- ─── 4. Rebuild revision_name to match corrected revision_number ──────────────
UPDATE document_revisions
SET
    revision_name = document_name || '_' || revision_number,
    updated_at    = NOW()
WHERE document_name IS NOT NULL
  AND revision_number IS NOT NULL
  AND (revision_name IS NULL OR revision_name NOT LIKE '%_' || revision_number);

-- ─── 5. Sync documents.version from the linked EFFECTIVE revision ─────────────
UPDATE documents d
SET
    version    = r.revision_number,
    updated_at = NOW()
FROM document_revisions r
WHERE r.document_id = d.id
  AND r.status_code = 'EFFECTIVE'
  AND d.version != r.revision_number;

-- ─── 6. Sync controlled_copies.revision_number from linked revision ───────────
UPDATE controlled_copies cc
SET
    revision_number = r.revision_number,
    updated_at      = NOW()
FROM document_revisions r
WHERE cc.revision_id = r.id
  AND (cc.revision_number IS NULL OR cc.revision_number != r.revision_number);
