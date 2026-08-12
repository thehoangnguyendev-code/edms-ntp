UPDATE controlled_copies cc
SET
    document_number = COALESCE(r.document_number, d.document_number, cc.document_number),
    document_title = COALESCE(r.document_name, d.document_name, cc.document_title),
    revision_number = COALESCE(r.revision_number, cc.revision_number),
    updated_at = NOW()
FROM document_revisions r
JOIN documents d ON d.id = r.document_id
WHERE cc.revision_id = r.id;

WITH normalized AS (
    SELECT
        cc.id,
        LEFT(
            REPLACE(COALESCE(r.document_number, d.document_number, cc.document_number), '-', '.')
            || '.'
            || REPLACE(COALESCE(r.revision_number, cc.revision_number), '-', '.')
            || '.Controlled.'
            || COALESCE(cc.copy_number, 1)::text,
            100
        ) AS candidate
    FROM controlled_copies cc
    JOIN document_revisions r ON r.id = cc.revision_id
    JOIN documents d ON d.id = cc.document_id
    WHERE COALESCE(r.document_number, d.document_number, cc.document_number) IS NOT NULL
      AND COALESCE(r.revision_number, cc.revision_number) IS NOT NULL
)
UPDATE controlled_copies cc
SET
    controlled_copy_number = normalized.candidate,
    updated_at = NOW()
FROM normalized
WHERE cc.id = normalized.id
  AND NOT EXISTS (
      SELECT 1
      FROM controlled_copies existing
      WHERE existing.controlled_copy_number = normalized.candidate
        AND existing.id <> cc.id
  );

UPDATE controlled_copies
SET
    controlled_copy_number = REPLACE(controlled_copy_number, '-', '.'),
    updated_at = NOW()
WHERE controlled_copy_number LIKE '%-%'
  AND NOT EXISTS (
      SELECT 1
      FROM controlled_copies existing
      WHERE existing.controlled_copy_number = REPLACE(controlled_copies.controlled_copy_number, '-', '.')
        AND existing.id <> controlled_copies.id
  );
