-- Enforce revision lifecycle invariants:
-- 1. revision_number must be unique within a document.
-- 2. at most one in-progress revision can exist for a document.

-- Keep the newest in-progress revision per document. Older in-progress rows are
-- closed so the partial unique index can be applied to existing databases.
WITH ranked_in_progress AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM document_revisions
    WHERE status_code IN (
        'DRAFT',
        'PENDING_REVIEW',
        'PENDING_APPROVAL',
        'PENDING_TRAINING',
        'READY_FOR_PUBLISHING'
    )
)
UPDATE document_revisions revision
SET
    status_code = 'CLOSED_CANCELLED',
    updated_at = NOW()
FROM ranked_in_progress ranked
WHERE revision.id = ranked.id
  AND ranked.rn > 1;

-- Renumber older duplicate revision_number rows per document. The newest row for
-- each duplicated number keeps its original identity; older rows move to the
-- next available patch numbers for that document.
WITH duplicate_rows AS (
    SELECT
        id,
        document_id,
        revision_number,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY document_id, revision_number
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM document_revisions
),
document_max_patch AS (
    SELECT
        document_id,
        COALESCE(MAX(
            CASE
                WHEN revision_number ~ '^[0-9]+\.0\.[0-9]+$'
                    THEN SPLIT_PART(revision_number, '.', 3)::INTEGER
                ELSE 0
            END
        ), 0) AS max_patch
    FROM document_revisions
    GROUP BY document_id
),
rows_to_renumber AS (
    SELECT
        duplicate_rows.id,
        duplicate_rows.revision_number,
        document_max_patch.max_patch,
        ROW_NUMBER() OVER (
            PARTITION BY duplicate_rows.document_id
            ORDER BY duplicate_rows.created_at ASC, duplicate_rows.id ASC
        ) AS seq
    FROM duplicate_rows
    JOIN document_max_patch ON document_max_patch.document_id = duplicate_rows.document_id
    WHERE duplicate_rows.rn > 1
),
new_numbers AS (
    SELECT
        id,
        CASE
            WHEN revision_number ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
                THEN SPLIT_PART(revision_number, '.', 1) || '.0.' || (max_patch + seq)::TEXT
            ELSE '0.0.' || (max_patch + seq)::TEXT
        END AS new_revision_number
    FROM rows_to_renumber
)
UPDATE document_revisions revision
SET
    revision_number = new_numbers.new_revision_number,
    revision_name = COALESCE(NULLIF(TRIM(revision.document_name), ''), revision.document_number) || '_' || new_numbers.new_revision_number,
    updated_at = NOW()
FROM new_numbers
WHERE revision.id = new_numbers.id;

-- Rebuild names once more after cleanup so display is consistent.
UPDATE document_revisions
SET
    revision_name = COALESCE(NULLIF(TRIM(document_name), ''), document_number) || '_' || revision_number,
    updated_at = NOW()
WHERE revision_number IS NOT NULL
  AND (
      revision_name IS NULL
      OR revision_name <> COALESCE(NULLIF(TRIM(document_name), ''), document_number) || '_' || revision_number
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_revisions_document_revision_number
    ON document_revisions (document_id, revision_number);

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_revisions_one_in_progress
    ON document_revisions (document_id)
    WHERE status_code IN (
        'DRAFT',
        'PENDING_REVIEW',
        'PENDING_APPROVAL',
        'PENDING_TRAINING',
        'READY_FOR_PUBLISHING'
    );
