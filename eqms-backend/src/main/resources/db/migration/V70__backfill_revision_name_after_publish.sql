-- V70: Backfill revision_name for all revisions where revision_name does not match
--      the current revision_number. This fixes data left stale by the bug in
--      publishRevisionRecord() which updated revision_number (e.g. "1.0.0") but
--      forgot to update revision_name (e.g. still "Title_0.0.1").
--
-- The correct format is: document_name || '_' || revision_number
-- e.g. "Quality Procedure for Document Control_1.0.0"

UPDATE document_revisions
SET
    revision_name = document_name || '_' || revision_number,
    updated_at    = NOW()
WHERE
    -- Fix rows where revision_name doesn't end with the current revision_number
    (
        revision_name IS NULL
        OR revision_name NOT LIKE '%_' || revision_number
    )
    -- Only touch rows that have both document_name and revision_number
    AND document_name IS NOT NULL
    AND revision_number IS NOT NULL;

-- Also sync controlled_copies.revision_number from the linked revision
-- in case some seeded rows still have stale or missing revision_number
UPDATE controlled_copies cc
SET
    revision_number = r.revision_number,
    document_title  = COALESCE(r.document_name, d.document_name, cc.document_title),
    document_number = COALESCE(r.document_number, d.document_number, cc.document_number),
    updated_at      = NOW()
FROM document_revisions r
JOIN documents d ON d.id = r.document_id
WHERE cc.revision_id = r.id
  AND (
    cc.revision_number IS NULL
    OR cc.revision_number <> r.revision_number
  );
