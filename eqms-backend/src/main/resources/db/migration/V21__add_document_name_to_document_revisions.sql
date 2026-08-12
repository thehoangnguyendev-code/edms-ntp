ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);

UPDATE document_revisions
SET document_name = CASE
    WHEN COALESCE(document_number, '') <> '' AND COALESCE(title, '') <> '' THEN document_number || ' - ' || title
    WHEN COALESCE(document_number, '') <> '' THEN document_number
    WHEN COALESCE(title, '') <> '' THEN title
    ELSE 'Untitled Document'
END
WHERE document_name IS NULL;

ALTER TABLE document_revisions
    ALTER COLUMN document_name SET NOT NULL;
