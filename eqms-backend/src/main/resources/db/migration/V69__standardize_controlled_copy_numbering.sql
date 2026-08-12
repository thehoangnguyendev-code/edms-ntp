WITH source_rows AS (
    SELECT
        cc.id,
        LEFT(
            'CC.'
            || REPLACE(COALESCE(r.document_number, d.document_number, cc.document_number), '-', '.')
            || '.R'
            || REPLACE(COALESCE(r.revision_number, cc.revision_number), '-', '.')
            || '.C'
            || LPAD(COALESCE(cc.copy_number, 1)::text, 3, '0'),
            100
        ) AS candidate,
        COALESCE(r.document_number, d.document_number, cc.document_number) AS source_document_number,
        COALESCE(r.document_name, d.document_name, cc.document_title) AS source_document_title,
        COALESCE(r.revision_number, cc.revision_number) AS source_revision_number
    FROM controlled_copies cc
    JOIN document_revisions r ON r.id = cc.revision_id
    JOIN documents d ON d.id = cc.document_id
    WHERE COALESCE(r.document_number, d.document_number, cc.document_number) IS NOT NULL
      AND COALESCE(r.revision_number, cc.revision_number) IS NOT NULL
),
unique_rows AS (
    SELECT source_rows.*
    FROM source_rows
    WHERE NOT EXISTS (
        SELECT 1
        FROM controlled_copies existing
        WHERE existing.controlled_copy_number = source_rows.candidate
          AND existing.id <> source_rows.id
    )
)
UPDATE controlled_copies cc
SET
    controlled_copy_number = unique_rows.candidate,
    document_number = unique_rows.source_document_number,
    document_title = CASE
        WHEN LOWER(REGEXP_REPLACE(unique_rows.source_document_title, '[-_.[:space:]]', '', 'g'))
             LIKE LOWER(REGEXP_REPLACE(unique_rows.source_document_number, '[-_.[:space:]]', '', 'g')) || '%'
        THEN NULLIF(
            TRIM(
                REGEXP_REPLACE(
                    SUBSTRING(unique_rows.source_document_title FROM LENGTH(unique_rows.source_document_number) + 1),
                    '^[[:space:]]*[-:|][[:space:]]*',
                    ''
                )
            ),
            ''
        )
        ELSE unique_rows.source_document_title
    END,
    revision_number = unique_rows.source_revision_number,
    updated_at = NOW()
FROM unique_rows
WHERE cc.id = unique_rows.id;
