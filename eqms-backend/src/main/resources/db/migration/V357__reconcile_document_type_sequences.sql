-- Keep the cached sequence aligned with already-issued document numbers.
-- The document-number prefix is authoritative so a historical type reassignment
-- cannot cause an existing number to be issued again.
UPDATE document_types document_type
SET current_sequence = GREATEST(
    document_type.current_sequence,
    COALESCE((
        SELECT MAX(CAST(SPLIT_PART(document.document_number, '.', 2) AS INTEGER))
        FROM documents document
        WHERE UPPER(SPLIT_PART(document.document_number, '.', 1)) = UPPER(document_type.short_code)
          AND document.document_number ~ '^[^.]+\.[0-9]{1,4}$'
    ), 0)
);
