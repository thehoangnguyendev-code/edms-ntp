ALTER TABLE documents
    RENAME COLUMN title TO document_name;

ALTER TABLE documents
    ALTER COLUMN document_name SET NOT NULL;
