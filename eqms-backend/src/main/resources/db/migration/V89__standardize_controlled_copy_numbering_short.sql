WITH numbered_rows AS (
    SELECT
        cc.id,
        'CC.'
        || REPLACE(COALESCE(d.document_number, cc.document_number, 'DOC'), '-', '.')
        || '.'
        || LPAD(
            ROW_NUMBER() OVER (
                PARTITION BY cc.document_id
                ORDER BY COALESCE(cc.copy_number, 0), COALESCE(cc.created_at, cc.updated_at), cc.id
            )::text,
            3,
            '0'
        ) AS candidate,
        COALESCE(d.document_number, cc.document_number) AS source_document_number
    FROM controlled_copies cc
    JOIN documents d ON d.id = cc.document_id
)
UPDATE controlled_copies cc
SET
    controlled_copy_number = numbered_rows.candidate,
    document_number = numbered_rows.source_document_number,
    updated_at = NOW()
FROM numbered_rows
WHERE cc.id = numbered_rows.id;
