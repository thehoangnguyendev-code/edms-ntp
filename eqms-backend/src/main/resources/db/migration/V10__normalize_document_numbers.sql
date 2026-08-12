-- Normalize legacy document/revision numbers to the new format:
-- Document: XXX.YYYY
-- Revision: XXX.YYYY.ZZ
-- The sequence is re-applied per document type, ordered by created_at, id.

WITH ranked_documents AS (
    SELECT
        d.id,
        upper(dt.short_code) AS type_code,
        row_number() OVER (
            PARTITION BY d.document_type_id
            ORDER BY d.created_at, d.id
        ) AS seq
    FROM documents d
    JOIN document_types dt ON dt.id = d.document_type_id
),
new_document_numbers AS (
    SELECT
        id,
        type_code || '.' || lpad(seq::text, 4, '0') AS new_number
    FROM ranked_documents
)
UPDATE documents d
SET document_number = n.new_number
FROM new_document_numbers n
WHERE d.id = n.id;

WITH ranked_revisions AS (
    SELECT
        r.id,
        d.document_number AS parent_number,
        row_number() OVER (
            PARTITION BY r.document_id
            ORDER BY r.created_at, r.id
        ) AS seq
    FROM document_revisions r
    JOIN documents d ON d.id = r.document_id
),
new_revision_numbers AS (
    SELECT
        id,
        parent_number || '.' || lpad(seq::text, 2, '0') AS new_number
    FROM ranked_revisions
)
UPDATE document_revisions r
SET document_number = n.new_number
FROM new_revision_numbers n
WHERE r.id = n.id;

UPDATE document_types dt
SET current_sequence = COALESCE((
    SELECT COUNT(*)
    FROM documents d
    WHERE d.document_type_id = dt.id
), 0);
