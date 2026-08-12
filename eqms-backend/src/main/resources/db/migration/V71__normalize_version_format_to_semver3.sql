-- V71: Normalize all revision_number values to canonical X.Y.Z (3-part semver) format.
--
-- Seed migrations V61 used 2-part versions like '1.0' and '0.1'.
-- This migration converts every revision_number (and document.version) that does not
-- already have exactly 3 dot-separated parts into the correct X.Y.Z form.
-- Examples:  '1.0'  → '1.0.0'
--            '0.1'  → '0.1.0'
--            '2'    → '2.0.0'
--            '1.0.0' → '1.0.0'  (unchanged)

-- ─── 1. Normalise document_revisions.revision_number ─────────────────────────
UPDATE document_revisions
SET
    revision_number = (
        -- split on '.', take up to 3 parts, zero-pad missing parts
        SPLIT_PART(revision_number, '.', 1) || '.' ||
        CASE WHEN SPLIT_PART(revision_number, '.', 2) = '' THEN '0'
             ELSE SPLIT_PART(revision_number, '.', 2) END || '.' ||
        CASE WHEN SPLIT_PART(revision_number, '.', 3) = '' THEN '0'
             ELSE SPLIT_PART(revision_number, '.', 3) END
    ),
    updated_at = NOW()
WHERE
    revision_number IS NOT NULL
    -- only rows that don't already have two dots (i.e. not X.Y.Z)
    AND LENGTH(revision_number) - LENGTH(REPLACE(revision_number, '.', '')) < 2;

-- ─── 2. Rebuild revision_name to match the normalised revision_number ─────────
UPDATE document_revisions
SET
    revision_name = document_name || '_' || revision_number,
    updated_at    = NOW()
WHERE
    document_name IS NOT NULL
    AND revision_number IS NOT NULL
    AND (
        revision_name IS NULL
        OR revision_name NOT LIKE '%_' || revision_number
    );

-- ─── 3. Normalise documents.version ──────────────────────────────────────────
UPDATE documents
SET
    version = (
        SPLIT_PART(version, '.', 1) || '.' ||
        CASE WHEN SPLIT_PART(version, '.', 2) = '' THEN '0'
             ELSE SPLIT_PART(version, '.', 2) END || '.' ||
        CASE WHEN SPLIT_PART(version, '.', 3) = '' THEN '0'
             ELSE SPLIT_PART(version, '.', 3) END
    ),
    updated_at = NOW()
WHERE
    version IS NOT NULL
    AND LENGTH(version) - LENGTH(REPLACE(version, '.', '')) < 2;

-- ─── 4. Sync controlled_copies.revision_number from the linked revision ───────
UPDATE controlled_copies cc
SET
    revision_number = r.revision_number,
    updated_at      = NOW()
FROM document_revisions r
WHERE cc.revision_id = r.id
  AND (
    cc.revision_number IS NULL
    OR cc.revision_number <> r.revision_number
  );
